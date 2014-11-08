/**
 * Created with PyCharm.
 * User: madrider
 * Date: 23.08.12
 * Time: 16:09
 * To change this template use File | Settings | File Templates.
 */

var interval = 5 * 1000;
var icon_point = "http://maps.google.com/mapfiles/marker_grey.png";
var icon_unit = "/static/icons/army.png";
var icon_base = "/static/icons/radar.png";
var center_point = null;
var map;
var show_degrees = true;
var server_data;
var units;
var points;

function resize_map() {
    var h = $(window).height();
    offsetTop = 0;
    $('#map_canvas').css('height', (h - offsetTop));
}

function rnd(n, k) {
    var d = Math.pow(10, k);
    return Math.round(n * d) / d;
}

function format_coord(n) {
    if (show_degrees) {
        return rnd(n, 6);
    }
    else {
        var d = Math.floor(n);
        n = (n - d) * 60;
        var m = add_0(Math.floor(n), 2);
        var s = (n - m) * 60;
        s = rnd(s, 2);
        return d + "º" + m + "'" + s + "\"";
    }
}

function add_0(n, k) {
    var s = n.toString();
    while (s.length < k) {
        s = '0' + s;
    }
    return s;
}

function dat(ts) {
    // date printer as dd.mm.yy hh:mm
    var d = new Date(ts * 1000);
    var dd = add_0(d.getDate(), 2);
    var m = add_0(d.getMonth() + 1, 2);
    var y = d.getFullYear() - 2000;
    var h = add_0(d.getHours(), 2);
    var mm = add_0(d.getMinutes(), 2);
    return dd + "." + m + "." + y + " " + h + ":" + mm;
}

function ago(ts) {
    // show date as hh:mm ago
//    var n = Math.round((new Date()).getTime() / 1000 - ts);
//    var m = Math.floor(n / 60);
//    n = n % 60;
//    res = m + ':' + add_0(n, 2);
    return ymaps.humanDuration((new Date()).getTime() / 1000 - ts);
}

function initialize(lat, lon) {
    resize_map();
    map = new ymaps.Map('map_canvas', {
        center:[lat, lon],
        zoom:13
    });
    map.setType('yandex#satellite');
    map.controls.add('scaleLine');
    map.controls.add('zoomControl');
    map.controls.add('typeSelector');

    $(window).resize(resize_map);

    map.events.add('click', function (event) {
        var ll = event.get('coordPosition');
        $('#lat')[0].value = rnd(ll[0], 6);
        $('#lon')[0].value = rnd(ll[1], 6);
        $('#add_form').show();
        $('#name')[0].focus();
    });

    map.events.add('mousemove', function (event) {
        var ll = event.get('coordPosition');
        var s;
        s = 'lat&nbsp;(Ш):&nbsp;' + format_coord(ll[0]) + ' lon&nbsp;(Д):&nbsp;' + format_coord(ll[1]);
        if (center_point) {
            var d = dist_bea(center_point, ll);
            s += '<br/>дист: ' + rnd(d[0], 0) + ' м, аз: ' + d[1] + 'º';
        }
        var t = $('#info');
        t.empty();
        t.append(s);
    });
    units = new ymaps.GeoObjectCollection();
    points = new ymaps.GeoObjectCollection();
    map.geoObjects.add(units);
    map.geoObjects.add(points);
    points.events.add('click', function (e) {
        var obj = e.get('target');
        center_point = obj.geometry.getCoordinates();
        show_markers();
    })
    points.options.set('preset', 'twirl#greyIcon');
    units.options.set('preset', 'twirl#blackStretchyIcon');

    get_server_data();
    setInterval(get_server_data, interval);
}

function dist_bea(p1, p2) {
    var yc = ymaps.coordSystem.geo.solveInverseProblem(p1, p2, false);
    var dist = yc.distance;
    var h = Math.acos(yc.startDirection[0]);
    h = h / Math.PI * 180;
    if (yc.startDirection[1] < 0) h = 360 - h;
    return [dist, h]
}

function get_server_data() {
    var dat = {};
//    if (center_point != null) {
//        dat['clat'] = center_point.getPosition().lat();
//        dat['clon'] = center_point.getPosition().lng();
//    }
    $.getJSON(json_url, dat, process_json);
}

function process_json(data) {
    $('#time').text('Обновлено в ' + dat(new Date().getTime() / 1000));
    server_data = data;
    show_markers();
}

function get_unit_marker(name) {
    var pt;
    units.each(function (p) {
        if (p.name == name) {
            pt = p;
        }
    });
    if (pt) {
        return pt;
    } else {
        var p = new ymaps.Placemark();
        p.name = name;
        p.properties.set('iconContent', name);
        units.add(p);
        return p;
    }
}

function get_point_marker(name) {
    var pt;
    points.each(function (p) {
        if (p.name == name) {
            pt = p;
        }
    });
    if (pt) {
        return pt;
    } else {
        var p = new ymaps.Placemark();
        p.name = name;
        p.properties.set('iconContent', name.substring(0, 1));
        points.add(p);
        return p;
    }
}

function show_markers() {
    // ############ Points
    var data = server_data;
    var t = $('#points');
    var point_names = {};
    var unit_names = {};
    t.empty();
    t.append('<tr><th>назв.</th><th>Lat (Ш)</th><th>Lon (Д)</th><th>дист.</th><th>аз.</th><th></th></tr>');
    for (var i = 0; i < data.points.length; i++) {
        p = data.points[i];
        point_names[p.name] = '';
        var row = '';
        row += '<tr>';
        row += '<td><a href="#" onclick="set_center_point(\'point\', \'' + p.name + '\'); return false;">' + p.name + '</a></td>';
        row += '<td>' + format_coord(p.lat) + '</td>';
        row += '<td>' + format_coord(p.lon) + '</td>';
        var d = null;
        if (center_point && [p.lat, p.lon] != center_point) {
            d = dist_bea(center_point, [p.lat, p.lon]);
        }
        row += '<td>';
        // if (p.dist) row += Math.round(p.dist) + 'm';
        if (d) row += Math.round(d[0]) + 'm';
        row += '</td>';
        row += '<td>';
        // if (p.h) row += Math.round(p.h) + 'º';
        if (d) row += Math.round(d[1]) + 'º';
        row += '</td>';
        row += '<td><a href="#" onclick="del_point(\'' + p.name + '\'); return false;">×</a></td>'
        row += '</tr>';
        t.append(row);
        var found = false;
        var m = get_point_marker(p.name);
        m.geometry.setCoordinates([p.lat, p.lon]);
    }

    // ###################### Units
    t = $('#units');
    t.empty();
    t.append('<tr><th>назв.</th><th>Lat (Ш)</th><th>Lon (Д)</th><th>обн.</th><th>дист.</th><th>аз.</th><th></th></tr>');
    for (var i = 0; i < data.units.length; i++) {
        p = data.units[i];
        unit_names[p.name] = '';
        var row = '';
        row += '<tr>';
        row += '<td><a href="#" onclick="set_center_point(\'unit\', \'' + p.name + '\'); return false;">' + p.name + '</a></td>';
        row += '<td>' + format_coord(p.lat) + '</td>';
        row += '<td>' + format_coord(p.lon) + '</td>';
        row += '<td>' + dat(p.updated) + '</td>';

        var d = null;
        if (center_point && [p.lat, p.lon] != center_point) {
            d = dist_bea(center_point, [p.lat, p.lon]);
        }
        row += '<td>';
        // if (p.dist) row += Math.round(p.dist) + 'm';
        if (d) row += Math.round(d[0]) + 'm';
        row += '</td>';
        row += '<td>';
        if (d) row += Math.round(d[1]) + 'º';
        row += '</td>';
        row += '<td><a href="#" onclick="del_unit(\'' + p.name + '\'); return false;">×</a></td>'
        row += '</tr>';
        t.append(row);
        var m = get_unit_marker(p.name);
        m.geometry.setCoordinates([p.lat, p.lon]);
        m.options.set('updated', p.updated);
        m.options.set('acc', p.acc);
        m.options.set('link', p.link);
    }
    points.each(function () {
        if (!p.name in point_names) {
            console.log('delete point ' + p.name);
            points.remove(p);
        }
    })
    units.each(function () {
        if (!p.name in unit_names) {
            console.log('delete unit ' + p.name);
            units.remove(p);
        }
    })
}

function del_point(s) {
    if (!confirm('Удалить точку ' + s + '?')) return;
    points.remove(get_point_marker(s));
    $.getJSON(json_url, {'action':'del', 'type':'point', 'name':s}, process_json);
}

function del_unit(s) {
    if (!confirm('Удалить юнит ' + s + '?')) return;
    units.remove(get_unit_marker(s));
    $.getJSON(json_url, {'action':'del', 'type':'unit', 'name':s}, process_json);
}

function set_center_point(t, name) {
    var obj;
    if (t == 'point') obj = get_point_marker(name);
    if (t == 'unit') obj = get_unit_marker(name);
    if (obj) {
        //m.marker.setIcon(icon_base);
        center_point = obj.geometry.getCoordinates();
        map.setCenter(center_point);
    }
    show_markers();
}

function add_point() {
    $.getJSON(json_url, {'action':'add', 'type':$('#type')[0].value, 'name':$('#name')[0].value, 'lat':$('#lat')[0].value, 'lon':$('#lon')[0].value}, process_json);
    $('#name')[0].value = '';
    $('#lat')[0].value = '';
    $('#lon')[0].value = '';
    $('#add_form').hide();
}

function show_bubble(obj) {
    var s = '';
    s += '<b>' + obj.name + '</b><br/>';
    s += 'позиция обновлена ' + dat(obj.updated) + '<br/>' + ago(obj.updated) + ' назад' + '<br/>';
    s += 'точность: ' + obj.acc + ' м.<br/>';
    s += '<a href="' + obj.link + '">link</a><br/>';
    for (i = 0; i < markersArray.length; i++) {
        p = markersArray[i];
        if (p.marker != obj.marker) {
            dist = google.maps.geometry.spherical.computeDistanceBetween(obj.marker.getPosition(), p.marker.getPosition());
            h = google.maps.geometry.spherical.computeHeading(obj.marker.getPosition(), p.marker.getPosition());
            if (h < 0) h = 360 + h;
            s += '<b>' + p.name + '</b>: ' + Math.round(dist) + 'm, ' + Math.round(h) + 'º<br/>';

        }
    }
    infowindow.setContent(s);
    infowindow.open(map, obj.marker);
}
