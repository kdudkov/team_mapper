"""
urls.py
URL dispatch route mappings and error handlers

"""

from flask import render_template

from application import app
import views


## URL dispatch rules
# App Engine warm up handler
# See http://code.google.com/appengine/docs/python/config/appconfig.html#Warming_Requests
#app.add_url_rule('/_ah/warmup', 'warmup', view_func=views.warmup)

# Home page
app.add_url_rule('/', 'home', view_func=views.home, methods=['GET', 'POST'])

app.add_url_rule('/team/<team_id>', 'map', view_func=views.team)
app.add_url_rule('/edit/<team_id>', 'edit', view_func=views.team_edit, methods=['GET', 'POST'])
app.add_url_rule('/unit/<unit_id>', 'unit', view_func=views.unit)
app.add_url_rule('/team/ajax/<team_id>', 'ajax', view_func=views.ajax, methods=['GET', 'POST'])
app.add_url_rule('/team/ajax/<team_id>/point', 'ajax_point', view_func=views.ajax_point, methods=['POST'])
app.add_url_rule('/team/ajax/<team_id>/point/<name>', 'ajax_point', view_func=views.ajax_point,
                 methods=['GET', 'DELETE'])
app.add_url_rule('/team/ajax/<team_id>/unit', 'ajax_unit', view_func=views.ajax_unit, methods=['GET', 'POST'])
app.add_url_rule('/c/', 'api', view_func=views.client_api, methods=['GET', 'POST'])
app.add_url_rule('/task/purge', 'task_purge', view_func=views.task_purge)


## Error handlers
# Handle 404 errors
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

# Handle 500 errors


@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500
