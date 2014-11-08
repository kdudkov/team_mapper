app = angular.module('app', []);

app.controller('MainCtrl',
    function ($log, $scope, $http, $timeout) {
        map_mouse_coords_callback = function (coords) {
            $scope.mouse_pos = coords;
            $scope.$digest();
        };

        map_click_callback = function (coords) {
            $scope.newpoint = { name: '', lat: coords[0], lon: coords[1] };
            $scope.$digest();
            $('#add_point_dialog').modal('show');
        };

        $scope.getData = function () {
            $scope.loading = true;
            $log.info('start fetching data from ' + url);
            $http.get(url)
                .success(function (data) {
                    $log.info('got data from server');
                    $scope.error = null;
                    processServerData(data);
                    $timeout($scope.getData, 10000);
                    $scope.loading = false;
                })
                .error(function (data, status) {
                    $log.error('error getting data, status ' + status);
                    $scope.error = 'error getting data';
                    $scope.loading = false;
                    $scope.$digest();
                    $timeout($scope.getData, 10000);
                });
        }

        function processServerData(data) {
            if (data.error) {
                $scope.error = data.error;
            }
            $scope.points = data.points;
            $scope.units = data.units;
            $.each($scope.points, function (i, pt) {
                add_point_marker(pt.name, [pt.lat, pt.lon]);
            });
            $.each($scope.units, function (i, pt) {
                add_unit_marker(pt.name, [pt.lat, pt.lon]);
            });
            $scope.last_data_from_server = new Date();
        }

        $scope.changeDegrees = function () {
            $scope.use_degrees = !$scope.use_degrees;
            $scope.use_degrees_text = $scope.use_degrees ? 'deg' : 'dms';
        };

        $scope.setCenterPoint = function (p) {
            $scope.center_point = p;
            set_map_center([p.lat, p.lon]);
        };

        $scope.addPointFromModal = function () {
            $('#add_point_dialog').modal('hide');
            $scope.addPoint($scope.newpoint.name, $scope.newpoint.lat, $scope.newpoint.lon);
        };

        $scope.addPoint = function (name, lat, lon) {
            var pt;
            $.each($scope.points, function (i, p) {
                if (p.name == name) pt = p;
            });
            if (pt == null) {
                pt = {name: name};
                $scope.points.push(pt);
            }
            pt.lat = lat;
            pt.lon = lon;
            add_point_marker(pt.name, [pt.lat, pt.lon]);
            $http.post(url + '/point', pt).success(function (data) {
                processServerData(data);
            });
        };

        $scope.deletePoint = function (p) {
            $http.delete(url + '/point/' + p.name).success(function (data) {
                delete_point_marker(p.name);
                processServerData(data)
            });
        };

        $scope.formatCoord = function (n) {
            if ($scope.degrees) {
                return $filter('number')(n, 6);
            }
            else {
                var d = Math.floor(n);
                n = (n - d) * 60;
                var m = add_0(Math.floor(n), 2);
                var s = (n - m) * 60;
                s = $filter('number')(s, 2);
                return d + "º" + m + "'" + s + "\"";
            }
        };

        $scope.loading = false;
        $scope.use_degrees = false;
        $scope.use_degrees_text = $scope.use_degrees ? 'deg' : 'dms';

        $scope.points = [];
        $scope.units = [];

        if (ya_ready) {
            $scope.getData();
        } else {
            map_ready_callback = $scope.getData;
        }
    });

app.filter('gps_coord', function () {
    return function (n, use_degrees) {
        numfilter = angular.injector(["ng"]).get('$filter')('number');
        if (use_degrees) {
            return numfilter(n, 6);
        }
        else {
            var d = Math.floor(n);
            n = (n - d) * 60;
            var m = add_0(Math.floor(n), 2);
            var s = (n - m) * 60;
            s = numfilter(s, 2);
            return d + "º" + m + "'" + s + "\"";
        }
    };
});

app.filter('distance', function () {
    return function (p1, lat, lon) {
        if (p1.lat == lat && p1.lon == lon) {
            return "";
        }
        n = get_dist_bea([p1.lat, p1.lon], [lat, lon]);
        if (n == null) return "";
        return Math.round(n[0]) + "м. " + Math.round(n[1]) + "º";
    }
});

function add_0(n, k) {
    var s = n.toString();
    while (s.length < k) {
        s = '0' + s;
    }
    return s;
}
