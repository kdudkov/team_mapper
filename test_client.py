#!/usr/bin/env python
import random
from urllib import urlencode
import time
import sys
import argparse
import json
import urllib2

__author__ = 'madrider'


def main():
    lat = 60.229487
    lon = 30.549601
    acc = u'24,000000'
    random.seed()

    while 1:
        lat += random.triangular(-0.0005, 0.0005)
        lon += random.triangular(-0.0005, 0.0005)
        url = 'http://%s/c/' % args.host
        data = {'code': args.code, 'name': args.name, 'lon': lon,
                'lat': lat, 'acc': acc}
        try:
            r = urllib2.urlopen(url, urlencode(data))
            res = json.loads(r.read())
            if 'error' in res:
                print res['error']
            else:
                print "%i point(s)" % len(res['points'])
                #print [x['name'] for x in res['units']]
        except Exception, ex:
            print ex
        time.sleep(5)

if __name__ == '__main__':
    global args

    parser = argparse.ArgumentParser(description='Process some integers.')
    parser.add_argument(
        '-d', dest='host', default='localhost:8080', help='host to connect')
    parser.add_argument('-n', dest='name', default='test_client', help='name')
    parser.add_argument('-c', dest='code', default='', help='code')
    args = parser.parse_args()
    if not args.code:
        parser.print_help()
        print "\nneed code to start"
        sys.exit(1)
    sys.exit(main())
