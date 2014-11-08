var map;
var unitMarkers;
var pointMarkers;

var map_mouse_coords_callback;
var map_click_callback;
var map_click_point_callback;
var map_click_unit_callback;
var map_ready_callback;
var ya_ready = false;

ymaps.ready(function () {
    ya_ready = true;
    if (map_ready_callback) {
        map_ready_callback();
    }

    map = new ymaps.Map('map_canvas', {
        center: center_point,
        zoom: 13,
        controls: ['zoomControl', 'typeSelector', 'geolocationControl', 'fullscreenControl']
    });
    map.setType('yandex#satellite');
    map.container.fitToViewport();
    $(window).resize(map.container.fitToViewport);

    map.events.add('dblclick', function (event) {
        if (map_click_callback) {
            map_click_callback(event.get('coords'));
        }
    });

    map.events.add('mousemove', function (event) {
        if (map_mouse_coords_callback) {
            map_mouse_coords_callback(event.get('coords'));
        }
    });

    unitMarkers = new ymaps.GeoObjectCollection();
    map.geoObjects.add(unitMarkers);
    unitMarkers.options.set('iconLayout', 'default#imageWithContent');
    unitMarkers.options.set('iconImageHref', '/static/icons/label1.png');
    unitMarkers.options.set('iconImageOffset', [0, -20]);
    unitMarkers.options.set('iconImageSize', [60, 30]);
    unitMarkers.events.add('click', function (e) {
        if (map_click_unit_callback) {
            map_click_unit_callback(e.get('target'), e.get('target').geometry.getCoordinates());
        }
    });


    pointMarkers = new ymaps.GeoObjectCollection();
    map.geoObjects.add(pointMarkers);
    pointMarkers.options.set('preset', 'islands#redIcon');
    pointMarkers.events.add('click', function (e) {
        if (map_click_point_callback) {
            map_click_point_callback(e.get('target'), e.get('target').geometry.getCoordinates());
        }
    });
});

function search_by_name(objList, name) {
    var foundObj;
    objList.each(function (obj) {
        if (obj.name == name) {
            foundObj = obj;
        }
    });
    return foundObj;
}

function delete_by_name(objList, name) {
    objList.each(function (obj) {
        if (obj.name == name) {
            objList.remove(obj);
        }
    });
}

function ago(ts) {
    if (!ya_ready) return;
    return ymaps.humanDuration((new Date()).getTime() / 1000 - ts);
}

function get_dist_bea(p1, p2) {
    if (!ya_ready) return;
    var yc = ymaps.coordSystem.geo.solveInverseProblem(p1, p2, false);
    var dist = yc.distance;
    var h = Math.acos(yc.startDirection[0]);
    h = h / Math.PI * 180;
    if (yc.startDirection[1] < 0) h = 360 - h;
    return [dist, h]
}

function set_map_center(coords) {
    map.setCenter(coords);
}

function add_unit_marker(name, coords) {
    var marker = search_by_name(unitMarkers, name);
    if (marker == null) {
        marker = new ymaps.Placemark();
        marker.name = name;
        marker.properties.set('iconContent', name.substring(0, 1));
        marker.properties.set('hintContent', 'Группа "' + name + '"');
        marker.properties.set('balloonContentHeader', 'Группа ' + name);
        marker.properties.set('balloonContentBody', name);

        unitMarkers.add(marker);
    }
    marker.geometry.setCoordinates(coords);
}

function add_point_marker(name, coords) {
    var marker = search_by_name(pointMarkers, name);
    if (marker == null) {
        marker = new ymaps.Placemark();
        marker.name = name;
        marker.properties.set('iconContent', name.substring(0, 1));
        marker.properties.set('hintContent', 'Точка "' + name + '"');
        pointMarkers.add(marker);
    }
    marker.geometry.setCoordinates(coords);
}

function delete_point_marker(name) {
    delete_by_name(pointMarkers, name);
}

