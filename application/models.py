# coding: utf-8

import random
import string
import time
import datetime
from google.appengine.api import users
from google.appengine.api import memcache
from google.appengine.ext.db import GeoPt
from google.appengine.ext import db
import gpslib


class Team(db.Model):
    name = db.StringProperty(required=True, indexed=True)
    owner = db.StringProperty(required=True, indexed=True)
    code = db.StringProperty(indexed=True)
    users = db.StringListProperty()
    last_used = db.DateTimeProperty(auto_now=True)

    def delete(self, **kwargs):
        # delete all units & points
        while True:
            q = Unit.all().ancestor(self)
            if not q.count():
                break
            db.delete(q.fetch(500))
        while True:
            q = Point.all().ancestor(self)
            if not q.count():
                break
            db.delete(q.fetch(500))
        db.Model.delete(self, **kwargs)

    @classmethod
    def get_by_key(cls, id):
        try:
            res = db.get(db.Key(id))
            assert isinstance(res, Team)
            if not res.code:
                res.gen_code()
                res.put()
            return res
        except:
            return None

    @classmethod
    def get_or_add(cls, name, owner, users=None):
        r = Team.all().filter('owner', owner).filter('name', name).get()
        if not r:
            r = Team(name=name, owner=owner, users=(users or []))
            r.gen_code()
            r.put()
        return r

    @classmethod
    def get_for_user(cls, user):
        if users.is_current_user_admin():
            return Team.gql("").fetch(100)
        else:
            res1 = Team.all().filter('owner', user).fetch(100)
            res2 = Team.all().filter('users', user).fetch(100)
            return res1 + res2

    @classmethod
    def get_by_code(cls, code):
        key = 'team_%s' % code
        obj = memcache.get_multi(key)
        if not obj:
            obj = Team.all().filter('code', code).get()
            memcache.add(key, obj)
        return obj

    def is_owner(self, user):
        if user == self.owner or users.is_current_user_admin():
            return True
        return False

    def is_good_for(self, user):
        if user == self.owner or user in self.users:
            return True
        if users.is_current_user_admin():
            return True
        return False

    def gen_code(self):
        s = ''
        random.seed()
        for i in range(5):
            s += random.choice(string.digits)
        self.code = s

    def get_point_by_name(self, name):
        return Point.all().ancestor(self).filter('name', name).get()

    def get_unit_by_name(self, name):
        return Unit.all().ancestor(self).filter('name', name).get()

    def get_or_add_unit(self, name, lon=0., lat=0.):
        u = Unit.all().ancestor(self).filter('name', name).get()
        if not u:
            u = Unit(parent=self, name=name)
            u.geo = GeoPt(lat, lon)
            u.put()
        return u

    def get_units(self):
        key = 'team_units_%s' % self.code
        obj = memcache.get(key)
        if not obj:
            obj = Unit.all().ancestor(self).fetch(500)
            memcache.add(key, obj)
        return obj

    def units_updated(self):
        key = 'team_units_%s' % self.code
        memcache.delete(key)

    def add_point(self, name, lon, lat):
        p = self.get_point_by_name(name)
        if not p:
            p = Point(parent=self, name=name)
        p.geo = GeoPt(lat, lon)
        p.put()
        return p

    def get_points(self):
        key = 'team_points_%s' % self.code
        obj = memcache.get(key)
        if not obj:
            obj = Point.all().ancestor(self).fetch(500)
            memcache.add(key, obj)
        return obj

    def points_updated(self):
        key = 'team_points_%s' % self.code
        memcache.delete(key)


class Unit(db.Model):
    name = db.StringProperty(required=True, indexed=True)
    geo = db.GeoPtProperty()
    accuracy = db.FloatProperty(required=False)
    updated = db.DateTimeProperty(auto_now=True)

    @classmethod
    def get_by_key(cls, id):
        try:
            res = db.get(db.Key(id))
            assert isinstance(res, Unit)
            return res
        except:
            return None

    def set_position(self, lat, lon, acc, dat=None):
        dat_ = dat if dat else datetime.datetime.now()
        self.geo = GeoPt(lat, lon)
        self.accuracy = acc
        self.updated = dat_
        self.put()
        # надо ли добавить точку в историю?
        prevs = self.get_positions(1)
        add_pos = False
        if not prevs:
            # нет истории - добавляем
            add_pos = True
        else:
            prev = prevs[0]
            # больше 5 минут от прошлой - добавляем
            if dat_ - prev.time > datetime.timedelta(minutes=5):
                add_pos = True
            else:
                # лучше точность - добавляем вместо прошлой
                if prev.accuracy > acc:
                    db.delete(prev)
                    add_pos = True
        if add_pos:
            p = Position(
                parent=self, geo=GeoPt(lat, lon), accuracy=acc, time=dat_)
            p.put()

    def get_positions(self, n=500):
        return Position.all().ancestor(self).order('-time').fetch(n)

    def to_dict(self, lon=None, lat=None):
        if not self.geo:
            self.geo = GeoPt(0., 0.)
        res = {'type': 'unit', 'name': self.name, 'lat': self.geo.lat, 'lon': self.geo.lon, 'acc': self.accuracy,
               'updated': time.mktime(self.updated.timetuple())}
        if lat and lon:
            if lat != self.geo.lat and lon != self.geo.lon:
                res['dist'], res['h'] = gpslib.distance(gpslib.Point(
                    lon, lat), gpslib.Point(self.geo.lon, self.geo.lat))
        return res

    def delete(self, **kwargs):
        # delete all positions
        while True:
            q = Position.all().ancestor(self)
            if not q.count():
                break
            db.delete(q.fetch(500))
        db.Model.delete(self, **kwargs)
        self.parent().units_updated()

    def put(self, **kwargs):
        db.Model.put(self, **kwargs)
        self.parent().units_updated()

    @classmethod
    def del_old(cls, date):
        while True:
            q = cls.gql("where updated < :1", date)
            if not q.count():
                break
            db.delete(q.fetch(500))

class Position(db.Model):
    geo = db.GeoPtProperty()
    time = db.DateTimeProperty(auto_now=True, indexed=True)
    accuracy = db.FloatProperty(required=False)

    @classmethod
    def del_old(cls, date):
        while True:
            q = cls.gql("where time < :1", date)
            if not q.count():
                break
            db.delete(q.fetch(500))


class Point(db.Model):
    name = db.StringProperty(required=True)
    geo = db.GeoPtProperty()
    color = db.IntegerProperty(default=0)
    icon = db.StringProperty()

    def to_dict(self, lon=None, lat=None):
        res = {'type': 'point', 'name': self.name, 'lat':
            self.geo.lat, 'lon': self.geo.lon, 'icon': self.icon}
        # adds distance to coords
        if lat and lon:
            if lat != self.geo.lat and lon != self.geo.lon:
                res['dist'], res['h'] = gpslib.distance(gpslib.Point(
                    lon, lat), gpslib.Point(self.geo.lon, self.geo.lat))
            else:
                res['dist'], res['h'] = 0, 0
        return res

    def delete(self, **kwargs):
        db.Model.delete(self, **kwargs)
        self.parent().points_updated()

    def put(self, **kwargs):
        db.Model.put(self, **kwargs)
        self.parent().points_updated()
