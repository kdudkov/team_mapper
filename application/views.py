# coding: utf-8

import logging
import datetime

from google.appengine.api import users
from google.appengine.ext.db import GeoPt
from application.decorators import login_required
from flask import redirect, render_template, request, jsonify, url_for, json

from application import app
from application.models import Team, Unit, Position


@login_required
def home():
    """
    экран входа с выбором команды
    """
    user = users.get_current_user()
    teams = Team.get_for_user(user.nickname())

    if request.method == 'POST':
        t = Team.get_or_add(request.form['name'], user.nickname(), request.form['users'].split())
        return redirect(url_for('map', team_id=t.key()))
    return render_template('enter.html', **locals())


@login_required
def team(team_id):
    """
    основной экран с картой
    """
    json_url = url_for('ajax', team_id=team_id)
    center_point = (59.95, 30.4)
    user = users.get_current_user()
    team = Team.get_by_key(team_id)
    if not team or not team.is_good_for(user.nickname()):
        return redirect(url_for('home'))
    team_key = str(team.key())
    return render_template('map.html', **locals())


@login_required
def team_edit(team_id):
    user = users.get_current_user()
    team = Team.get_by_key(team_id)
    if request.method == 'POST':
        team.users = request.form.get('users').split()
        team.save()
        return redirect(url_for('home'))
    if not team or not team.is_good_for(user.nickname()):
        return redirect(url_for('home'))
    emails = " ".join(team.users)
    return render_template('edit.html', **locals())


def get_all_data(team):
    res = {}
    res['points'] = [p.to_dict() for p in team.get_points()]
    res['units'] = [p.to_dict() for p in team.get_units()]
    return res


@login_required
def unit(unit_id):
    clat = 59.95
    clon = 30.4
    #    name = request.form['name']
    user = users.get_current_user()
    #    team = Team.get_by_key(id)
    #    if not team.is_good_for(user):
    #        redirect('/')
    #    unit = team.get_unit_by_name(name)
    unit = Unit.get_by_key(unit_id)
    if not unit:
        error = 'нет такого юнита'
    else:
        pos = unit.get_positions()
        if len(pos):
            clat = pos[0].geo.lat
            clon = pos[0].geo.lon
    return render_template('unit.html', **locals())


@login_required
def ajax(team_id):
    app.logger.info('ajax get data')
    user = users.get_current_user()
    team = Team.get_by_key(team_id)
    if not team or not team.is_good_for(user.nickname()):
        app.logger.error('invalid team key')
        res = {'error': 'invalid team'}
        return jsonify(**res)
    res = get_all_data(team)
    return jsonify(**res)


@login_required
def ajax_point(team_id, name=None):
    app.logger.info('point json')
    user = users.get_current_user()
    team = Team.get_by_key(team_id)
    if not team or not team.is_good_for(user.nickname()):
        app.logger.error('invalid team key')
        res = {'error': 'invalid team'}
        return jsonify(**res)
    if request.method == 'POST':
        data = json.loads(request.data)
        p = team.get_point_by_name(data['name'])
        if not p:
            p = team.add_point(data['name'], data['lat'], data['lon'])
            app.logger.info('new point %s' % data['name'])
        p.geo = GeoPt(data['lat'], data['lon'])
        p.put()
    if request.method == 'DELETE' and name:
        p = team.get_point_by_name(name)
        if p:
            app.logger.info('delete point %s' % name)
            p.delete()
        else:
            app.logger.error('no point %s' % name)
    res = get_all_data(team)
    return jsonify(**res)


@login_required
def ajax_unit(team_id):
    app.logger.info('unit json')
    user = users.get_current_user()
    team = Team.get_by_key(team_id)
    if not team or not team.is_good_for(user.nickname()):
        res = {'error': 'invalid team'}
        return jsonify(**res)
    res = get_all_data(team)
    return jsonify(**res)


def task_purge():
    date = datetime.datetime.now() - datetime.timedelta(days=5)
    Position.del_old(date)
    Unit.del_old(date)
    return "ok"


def client_api():
    d = json.loads(request.data)
    code = d.get('code')
    if not code:
        res = {'error': 'code required'}
        return jsonify(**res)
    team = Team.get_by_code(code)
    if not team:
        res = {'error': 'invalid team code'}
        return jsonify(**res)
    if not d.get('name'):
        res = {'error': 'need name'}
        return jsonify(**res)

    # update pos
    parm = {}
    for name in ('lat', 'lon', 'acc'):
        if name in d:
            try:
                parm[name] = float(d[name].replace(',', '.'))
            except:
                pass
    u = team.get_or_add_unit(d['name'])
    if 'lon' in parm and 'lat' in parm:
        u.set_position(parm['lat'], parm['lon'], parm.get('acc', 0.))
        app.logger.info("position of %s updated to %s %s" % (d[
                                                             'name'], parm['lon'], parm['lat']))

    #actions
    if d.get('action') == 'add':
        try:
            lat1 = float(d.get('plat'))
            lon1 = float(d.get('plon'))
            name1 = d.get('pname')
            if name1:
                team.add_point(name1, lon1, lat1)
        except Exception, ex:
            app.logger.exception(ex)
            #prepare res
    res = {}
    res['points'] = [p.to_dict() for p in team.get_points()]
    res['units'] = [p.to_dict() for p in team.get_units() if p.name != d['name']]
    return jsonify(**res)
