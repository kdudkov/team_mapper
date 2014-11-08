#!/usr/bin/env python
from google.appengine.api.users import User

__author__ = 'madrider'

import unittest
from google.appengine.ext import testbed
from google.appengine.datastore import datastore_stub_util
import json

from models import Team, Unit


class Test1(unittest.TestCase):
    def setUp(self):
        # First, create an instance of the Testbed class.
        self.testbed = testbed.Testbed()
        # Then activate the testbed, which prepares the service stubs for use.
        self.testbed.activate()
        # Create a consistency policy that will simulate the High Replication consistency model.
        self.policy = datastore_stub_util.PseudoRandomHRConsistencyPolicy(probability=1)
        # Initialize the datastore stub with this policy.
        self.testbed.init_datastore_v3_stub(consistency_policy=self.policy)
        self.testbed.init_memcache_stub()
        self.user = 'name@gmail.com'

    def test_team_get_or_add(self):
        assert Team.all().count() == 0
        t = Team.get_or_add("team1", self.user, ['user2@gmail.com', 'user3@gmail.com'])
        assert Team.all().count() == 1
        t2 = Team.get_or_add("team2", self.user, ['user2@gmail.com'])
        assert Team.all().count() == 2
        t = Team.get_or_add("team1", self.user)
        assert Team.all().count() == 2
        assert len(Team.get_for_user(self.user)) == 2
        assert len(Team.get_for_user('name@gmail.com')) == 2
        assert len(Team.get_for_user('user2@gmail.com')) == 2
        assert len(Team.get_for_user('user3@gmail.com')) == 1
        t2.delete()
        assert Team.all().count() == 1

    def test_team_get_by_name(self):
        t = Team.get_or_add("team1", self.user)
        t.code = '111'
        t.put()
        t1 = Team.get_by_code('111')
        assert t1 is not None
        assert t1.code == '111'
        assert t1.name == 'team1'
        t2 = Team.get_by_code('112')
        assert t2 is None

    def test_unit(self):
        team = Team.get_or_add("team1", self.user)
        assert Unit.all().count() == 0
        team.get_or_add_unit("u1")
        assert Unit.all().count() == 1
        team.get_or_add_unit("u1")
        assert Unit.all().count() == 1
        team.get_or_add_unit("u2")
        assert Unit.all().count() == 2
        assert len(team.get_units()) == 2

        team2 = Team.get_or_add("team2", self.user)
        team2.get_or_add_unit("u2")
        assert Unit.all().count() == 3
        assert len(team.get_units()) == 2
        assert len(team2.get_units()) == 1

        team2.delete()
        assert Unit.all().count() == 2

    def ttest_unit_addpoint(self):
        user = User('name@gmail.com')
        team = Team.get_or_add("team1", user)
        u1 = team.get_or_add_unit("u1")
        u1.add_position(30.0, 60.0)
        assert len(u1.get_positions()) == 1
        assert u1.geo.lon == 30
        u1.add_position(30.1, 60.1, 0.0)
        assert len(u1.get_positions()) == 2
        assert u1.geo.lon == 30.1

if __name__ == '__main__':
    unittest.main()
