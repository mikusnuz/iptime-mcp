import { IptimeError } from './errors.js';
import type { JsonValue, Risk } from './types.js';

export interface OperationSpec {
  operation: string;
  method: string;
  domain: string;
  mode: 'read' | 'write';
  risk: Risk;
  description: string;
  readback?: string;
  paramsHint?: string;
  defaultParams?: JsonValue;
}

const readGroups: Record<string, string[]> = {
  session: ['session/info', 'ui/pages', 'product/info', 'system/info', 'system/name', 'system/temperature'],
  administration: ['admin/account', 'admin/auth', 'admin/email', 'acl/show', 'https/cert/info', 'assistance/info'],
  system: ['time/config', 'firmware/info', 'firmware/upgrade/status', 'reboot/timer', 'syslog/config', 'syslog/show', 'led/config', 'fan/config', 'fan/status', 'power/config'],
  network: ['network/info', 'network/interface/lan/info', 'network/interface/lan/config', 'network/interface/lan/stations', 'network/interface/lan/scan/status', 'network/interface/wan1/info', 'network/interface/wan1/config', 'network/interface/wan1/scan/status', 'network/dns/config', 'network/dns/cache/show', 'network/arp/show'],
  dhcp: ['dhcpd/config', 'dhcpd/lease/show', 'dhcpd/reservedaddr/show'],
  routing: ['route/static/show', 'port/num', 'port/role/info', 'port/link/info', 'port/stat/info', 'switch/jumbo_frame/config', 'switch/mirror/config', 'switch/trunk/config', 'macvlan/show', 'iptv/config'],
  wireless: ['wireless/info', 'wireless/band/support', 'wireless/band/config', 'wireless/bss/show', 'wireless/bss/config', 'wireless/channel/config', 'wireless/scan', 'wireless/client/show', 'wireless/mac/show', 'wireless/wps/config', 'wireless/mlo/info'],
  easymesh: ['easymesh/info', 'easymesh/config', 'easymesh/show/agent'],
  nat: ['nat/config', 'dmz/config', 'portforward/show', 'upnp/config', 'upnp/show', 'conn/show'],
  security: ['firewall/config', 'firewall/rule/show', 'dos/config', 'geoip/config', 'geoip/show', 'url/config', 'url/show', 'urlredir/show'],
  qos: ['qos/config', 'qos/rule/show', 'diffserv/config'],
  vpn: ['wg/server/config', 'wg/client/show', 'wg/peer/show', 'pptp/server/config', 'l2tp/server/config', 'ppp/user/show', 'vpncli/show', 'vpncli/status', 'mudfish/config'],
  remote: ['ddns/config', 'ddns/status', 'cwmp/config', 'snmp/config'],
  usb: ['usb/info', 'usb/device/show', 'partition/show', 'samba/config', 'ftp/config', 'http/config', 'media/config', 'torrent/config', 'cupsd/config', 'nas/user/show', 'snapshot/config', 'snapshot/show', 'btrfs/info', 'tethering/config'],
  automation: ['routine/services', 'routine/get', 'routine/status', 'routine/expire', 'history/config', 'history/show', 'historyd/status', 'hostscan/config', 'hostscan/show', 'wol/show'],
};

const writeGroups: Record<string, Array<[string, Risk, string?]>> = {
  session: [['session/update', 'reversible'], ['session/logout', 'reversible']],
  administration: [
    ['admin/account/set', 'critical', 'admin/account'], ['admin/auth/set', 'critical', 'admin/auth'],
    ['admin/email/set', 'reversible', 'admin/email'], ['acl/add', 'connectivity', 'acl/show'],
    ['acl/set', 'connectivity', 'acl/show'], ['acl/del', 'connectivity', 'acl/show'],
    ['https/cert/set', 'critical', 'https/cert/info'], ['assistance/set', 'critical', 'assistance/info'],
  ],
  system: [
    ['time/set', 'reversible', 'time/config'], ['config/restore', 'critical'], ['config/reset', 'critical'],
    ['firmware/upgrade/prepare', 'critical', 'firmware/upgrade/status'], ['reboot/now', 'critical'],
    ['reboot/timer/set', 'critical', 'reboot/timer'], ['syslog/set', 'reversible', 'syslog/config'],
    ['syslog/clear', 'reversible', 'syslog/show'], ['led/set', 'reversible', 'led/config'],
    ['fan/set', 'reversible', 'fan/config'], ['power/set', 'connectivity', 'power/config'],
  ],
  network: [
    ['network/interface/lan/set', 'connectivity', 'network/interface/lan/config'],
    ['network/interface/lan/scan/start', 'reversible', 'network/interface/lan/scan/status'],
    ['network/interface/wan1/set', 'connectivity', 'network/interface/wan1/config'],
    ['network/interface/wan1/scan/start', 'reversible', 'network/interface/wan1/scan/status'],
    ['network/interface/wan1/suspend', 'connectivity', 'network/interface/wan1/info'],
    ['network/interface/wan1/resume', 'connectivity', 'network/interface/wan1/info'],
    ['network/dns/set', 'connectivity', 'network/dns/config'], ['network/dns/cache/flush', 'reversible', 'network/dns/cache/show'],
    ['network/arp/flush', 'reversible', 'network/arp/show'],
  ],
  dhcp: [
    ['dhcpd/set', 'connectivity', 'dhcpd/config'], ['dhcpd/reservedaddr/add', 'reversible', 'dhcpd/reservedaddr/show'],
    ['dhcpd/reservedaddr/set', 'reversible', 'dhcpd/reservedaddr/show'], ['dhcpd/reservedaddr/del', 'reversible', 'dhcpd/reservedaddr/show'],
  ],
  routing: [
    ['route/static/add', 'connectivity', 'route/static/show'], ['route/static/set', 'connectivity', 'route/static/show'],
    ['route/static/del', 'connectivity', 'route/static/show'], ['port/role/set', 'connectivity', 'port/role/info'],
    ['port/link/set', 'connectivity', 'port/link/info'], ['port/stat/reset', 'reversible', 'port/stat/info'],
    ['switch/jumbo_frame/set', 'connectivity', 'switch/jumbo_frame/config'], ['switch/mirror/set', 'connectivity', 'switch/mirror/config'],
    ['switch/trunk/set', 'connectivity', 'switch/trunk/config'], ['macvlan/add', 'connectivity', 'macvlan/show'],
    ['macvlan/set', 'connectivity', 'macvlan/show'], ['macvlan/del', 'connectivity', 'macvlan/show'],
    ['iptv/set', 'connectivity', 'iptv/config'],
  ],
  wireless: [
    ['wireless/band/set', 'connectivity', 'wireless/band/config'], ['wireless/bss/add', 'connectivity', 'wireless/bss/show'],
    ['wireless/bss/set', 'connectivity', 'wireless/bss/config'], ['wireless/bss/del', 'connectivity', 'wireless/bss/show'],
    ['wireless/channel/set', 'connectivity', 'wireless/channel/config'], ['wireless/scan/start', 'reversible', 'wireless/scan'],
    ['wireless/client/disconnect', 'reversible', 'wireless/client/show'], ['wireless/mac/add', 'reversible', 'wireless/mac/show'],
    ['wireless/mac/del', 'reversible', 'wireless/mac/show'], ['wireless/wps/start', 'connectivity', 'wireless/wps/config'],
    ['wireless/wps/stop', 'reversible', 'wireless/wps/config'],
  ],
  easymesh: [
    ['easymesh/set', 'connectivity', 'easymesh/config'], ['easymesh/agent/add', 'connectivity', 'easymesh/show/agent'],
    ['easymesh/agent/del', 'connectivity', 'easymesh/show/agent'], ['easymesh/agent/reboot', 'critical', 'easymesh/show/agent'],
  ],
  nat: [
    ['nat/set', 'connectivity', 'nat/config'], ['dmz/set', 'connectivity', 'dmz/config'],
    ['portforward/add', 'reversible', 'portforward/show'], ['portforward/set', 'reversible', 'portforward/show'],
    ['portforward/del', 'reversible', 'portforward/show'], ['upnp/set', 'reversible', 'upnp/config'],
    ['upnp/del', 'reversible', 'upnp/show'], ['conn/kill', 'reversible', 'conn/show'],
  ],
  security: [
    ['firewall/set', 'connectivity', 'firewall/config'], ['firewall/rule/add', 'connectivity', 'firewall/rule/show'],
    ['firewall/rule/set', 'connectivity', 'firewall/rule/show'], ['firewall/rule/del', 'connectivity', 'firewall/rule/show'],
    ['dos/set', 'reversible', 'dos/config'], ['geoip/set', 'connectivity', 'geoip/config'],
    ['url/set', 'connectivity', 'url/config'], ['url/add', 'connectivity', 'url/show'], ['url/del', 'connectivity', 'url/show'],
    ['urlredir/add', 'connectivity', 'urlredir/show'], ['urlredir/set', 'connectivity', 'urlredir/show'], ['urlredir/del', 'connectivity', 'urlredir/show'],
  ],
  qos: [
    ['qos/set', 'reversible', 'qos/config'], ['qos/rule/add', 'reversible', 'qos/rule/show'],
    ['qos/rule/set', 'reversible', 'qos/rule/show'], ['qos/rule/del', 'reversible', 'qos/rule/show'],
    ['diffserv/set', 'reversible', 'diffserv/config'],
  ],
  vpn: [
    ['wg/server/set', 'reversible', 'wg/server/config'], ['wg/client/add', 'reversible', 'wg/client/show'],
    ['wg/client/set', 'reversible', 'wg/client/show'], ['wg/client/del', 'reversible', 'wg/client/show'],
    ['wg/peer/add', 'reversible', 'wg/peer/show'], ['wg/peer/set', 'reversible', 'wg/peer/show'], ['wg/peer/del', 'reversible', 'wg/peer/show'],
    ['pptp/server/set', 'reversible', 'pptp/server/config'], ['l2tp/server/set', 'reversible', 'l2tp/server/config'],
    ['ppp/user/add', 'reversible', 'ppp/user/show'], ['ppp/user/set', 'reversible', 'ppp/user/show'], ['ppp/user/del', 'reversible', 'ppp/user/show'],
    ['vpncli/add', 'reversible', 'vpncli/show'], ['vpncli/set', 'reversible', 'vpncli/show'], ['vpncli/del', 'reversible', 'vpncli/show'],
    ['vpncli/connect', 'reversible', 'vpncli/status'], ['vpncli/disconnect', 'reversible', 'vpncli/status'], ['vpncli/upload/config', 'reversible', 'vpncli/show'],
    ['mudfish/set', 'reversible', 'mudfish/config'],
  ],
  remote: [
    ['ddns/set', 'reversible', 'ddns/config'], ['ddns/update', 'reversible', 'ddns/status'],
    ['cwmp/set', 'critical', 'cwmp/config'], ['snmp/set', 'critical', 'snmp/config'],
  ],
  usb: [
    ['usb/eject', 'reversible', 'usb/device/show'], ['partition/format', 'critical', 'partition/show'],
    ['samba/set', 'reversible', 'samba/config'], ['ftp/set', 'reversible', 'ftp/config'], ['http/set', 'reversible', 'http/config'],
    ['media/set', 'reversible', 'media/config'], ['torrent/set', 'reversible', 'torrent/config'], ['cupsd/set', 'reversible', 'cupsd/config'],
    ['nas/user/add', 'reversible', 'nas/user/show'], ['nas/user/set', 'reversible', 'nas/user/show'], ['nas/user/del', 'reversible', 'nas/user/show'],
    ['snapshot/set', 'reversible', 'snapshot/config'], ['snapshot/create', 'reversible', 'snapshot/show'], ['snapshot/del', 'critical', 'snapshot/show'],
    ['tethering/set', 'connectivity', 'tethering/config'],
  ],
  automation: [
    ['routine/add', 'reversible', 'routine/get'], ['routine/set', 'reversible', 'routine/get'], ['routine/del', 'reversible', 'routine/get'],
    ['history/set', 'reversible', 'history/config'], ['history/clear', 'reversible', 'history/show'],
    ['hostscan/set', 'reversible', 'hostscan/config'], ['hostscan/start', 'reversible', 'hostscan/show'],
    ['wol/add', 'reversible', 'wol/show'], ['wol/del', 'reversible', 'wol/show'], ['wol/wakeup', 'reversible', 'wol/show'],
  ],
};

const descriptions: Record<string, string> = {
  'product/info': 'Read router model and product information',
  'system/info': 'Read firmware and system status',
  'network/info': 'Read network summary',
  'wireless/bss/show': 'List wireless networks',
  'wireless/client/show': 'List connected wireless clients',
  'portforward/show': 'List port-forwarding rules',
  'wol/wakeup': 'Send Wake-on-LAN from the router',
};

// Methods present in the iUX3 application shipped with firmware 15.36.6.
// Model-specific availability is still checked with api/has before use.
const observedIux3Methods = new Set(`
acl/config
acl/whitelist/add
acl/whitelist/del
admin/account
admin/auth
admin/changed
admin/email
admin/email/clear
admin/email/is_set
assistance/config
assistance/icc/config
assistance/icc/info
btrfs/check
btrfs/scrub
btrfs/subvol/convert
cert/remote
config/backup
config/reset
config/restore
conn/ctrl
conn/defaults
conn/info
cupsd/config
cupsd/status
cwmp/get
cwmp/set
cwmp/status
ddns/config
ddns/config/add
ddns/config/del
ddns/status/clear
ddns/status/get
ddns/update
default/admin
dhcpd/config/get
dhcpd/config/set
dhcpd/lease/show
dhcpd/reservedaddr/add
dhcpd/reservedaddr/del
dhcpd/reservedaddr/show
dhcpd/status
diffserv/config
dmz/config
dos/config
easymesh/config
easymesh/info
easymesh/show/agent
ext4/check
fan/config
fan/config/original
fan/running
firewall/add
firewall/del
firewall/get
firewall/max
firewall/set
firmware/info
firmware/upgrade/online
firmware/upgrade/prepare
firmware/upgrade/status
firmware/version/latest
ftp/config
ftp/port/add
ftp/port/del
ftp/port/list
geoip/blocked/pcount
geoip/country/list
geoip/db/download
geoip/enable
geoip/get
geoip/policy/remove
geoip/policy/set
geoip/white/list
geoip/white/remove
geoip/white/set
history/range/spec
history/station/connection/state
history/station/count/chart
history/station/count/max
history/station/count/stalist
history/station/disconnection/count/chart
history/station/disconnection/count/max
history/station/rssi/chart
history/station/rssi/min
historyd/clear
historyd/config
historyd/storage/status
hostscan/log/clear
hostscan/log/read
hostscan/params
hostscan/progressing
hostscan/start
hostscan/stop
http/config
https/cert/config
httpsd/port
https/cert/del
https/cert/gen
https/cert/get
https/cert/info
https/cert/set
httpsd/port
icc/cli/connect/status
icc/cli/enroll
icc/cli/enroll/cancel
icc/cli/enroll/info
icc/cli/enroll/status
icc/cli/profile
icc/cli/site_config/show
iptv/config
iptv/mode
iptv/public/port
l2tp/server/config
led/config
led/status
macvlan/add
macvlan/del
macvlan/get
media/config
media/db/show
media/db/update
mudfish/config
mudfish/status
nas/user/add
nas/user/del
nas/user/info
nas/user/modify
nas/user/show
nas/user/show/online
nat/config
network/arp/flush
network/dns/config
network/dns/info
network/info
network/interface/lan/config
network/interface/lan/info
network/interface/lan/scan/apcp
network/interface/lan/scan/dhcp
network/interface/lan/stations
network/interface/wan1/config
network/interface/wan1/info
network/interface/wan1/resume
network/interface/wan1/scan
network/interface/wan1/suspend
partition/add
partition/check
partition/del
partition/format
port/link/config
port/link/info
port/link/status
port/num
port/role
port/stat/clear
port/stat/get
portforward/add
portforward/del
portforward/get
portforward/max
portforward/set
power/beep
power/report_on_error
power/status
ppp/user/add
ppp/user/del
ppp/user/disconnect
ppp/user/max
ppp/user/set
ppp/user/show
pptp/server/config
product/info
product/name
qos/config
qos/rule/del
qos/rule/set
qos/rule/show
reboot/now
reboot/timer
route/static/add
route/static/del
route/static/max
route/static/set
route/static/show
routine/add
routine/expire
routine/get
samba/config
session/info
session/logout
session/update
snapshot/config
snapshot/delall
snapshot/new
snmp/get
snmp/set
snmp/trap/get
snmp/trap/set
switch/jumbo_frame/config
switch/mirror/config
switch/mirror/port
switch/trunk/config
switch/trunk/port
syslog/active
syslog/clear
syslog/email/config
syslog/email/send
syslog/max
syslog/show
system/info
system/name
system/temperature
tethering/config
tethering/status
time/config
torrent/config
ui/favorite/add
ui/favorite/del
ui/favorite/show
ui/lang/config
ui/lang/list
ui/pages
upnp/config
upnp/relay
url/config
urlredir/config
urlredir/freedevice/add
urlredir/freedevice/del
urlredir/freedevice/show
usb/event/count
usb/mode
usb/mount
usb/mount/list
usb/service/apply
usb/service/status
usb/show
usb/umount
vpncli/connect
vpncli/disconnect
vpncli/filter/list
vpncli/filter/remove
vpncli/filter/set
vpncli/server/list
vpncli/server/remove
vpncli/server/set
vpncli/status/list
vpncli/upload/config
wan/heartbeat
wg/client/add
wg/client/change
wg/client/del
wg/client/show
wg/peer/add
wg/peer/change
wg/peer/del
wg/peer/show
wg/server/clear
wg/server/set
wg/server/show
wireless/band/info
wireless/band/set
wireless/band/show
wireless/band/support
wireless/bss/clear
wireless/bss/info
wireless/bss/set
wireless/bss/show
wireless/channel/list
wireless/channel/scan
wireless/client/info
wireless/client/set
wireless/client/show
wireless/info
wireless/mac/add
wireless/mac/del
wireless/mac/policy
wireless/mac/show
wireless/mlo/info
wireless/scan
wireless/wps/info
wireless/wps/start
wireless/wps/stop
wl/operation
wol/add
wol/del
wol/show
wol/signal
`.trim().split('\n'));

const actionWrites = new Set(`
acl/whitelist/add
acl/whitelist/del
admin/email/clear
btrfs/check
btrfs/scrub
btrfs/subvol/convert
config/reset
config/restore
conn/ctrl
cwmp/set
ddns/config/add
ddns/config/del
ddns/status/clear
ddns/update
dhcpd/config/set
dhcpd/reservedaddr/add
dhcpd/reservedaddr/del
ext4/check
firewall/add
firewall/del
firewall/set
firmware/upgrade/online
firmware/upgrade/prepare
ftp/port/add
ftp/port/del
geoip/db/download
geoip/policy/remove
geoip/policy/set
geoip/white/remove
geoip/white/set
historyd/clear
hostscan/log/clear
hostscan/start
hostscan/stop
https/cert/del
https/cert/gen
https/cert/set
icc/cli/enroll
icc/cli/enroll/cancel
macvlan/add
macvlan/del
media/db/update
nas/user/add
nas/user/del
nas/user/modify
network/arp/flush
network/interface/lan/scan/apcp
network/interface/lan/scan/dhcp
network/interface/wan1/resume
network/interface/wan1/scan
network/interface/wan1/suspend
partition/add
partition/check
partition/del
partition/format
port/stat/clear
portforward/add
portforward/del
portforward/set
power/beep
ppp/user/add
ppp/user/del
ppp/user/disconnect
ppp/user/set
qos/rule/del
qos/rule/set
reboot/now
route/static/add
route/static/del
route/static/set
routine/add
routine/expire
session/logout
session/update
snapshot/delall
snapshot/new
snmp/set
snmp/trap/set
syslog/clear
syslog/email/send
ui/favorite/add
ui/favorite/del
usb/mount
usb/service/apply
usb/umount
vpncli/connect
vpncli/disconnect
vpncli/filter/remove
vpncli/filter/set
vpncli/server/remove
vpncli/server/set
vpncli/upload/config
wg/client/add
wg/client/change
wg/client/del
wg/peer/add
wg/peer/change
wg/peer/del
wg/server/clear
wg/server/set
wireless/band/set
wireless/bss/clear
wireless/bss/set
wireless/channel/scan
wireless/client/set
wireless/mac/add
wireless/mac/del
wireless/mac/policy
wireless/wps/start
wireless/wps/stop
wl/operation
wol/add
wol/del
wol/signal
`.trim().split('\n'));

// These endpoints read with empty/query params and update when configuration
// fields are present. Separate operation names keep reads and writes explicit.
const sharedConfigWrites = new Set(`
acl/config
admin/account
admin/auth
admin/email
assistance/config
assistance/icc/config
cupsd/config
ddns/config
diffserv/config
dmz/config
dos/config
easymesh/config
fan/config
ftp/config
geoip/enable
historyd/config
hostscan/params
http/config
https/cert/config
iptv/config
l2tp/server/config
led/config
media/config
mudfish/config
nat/config
network/dns/config
network/interface/lan/config
network/interface/wan1/config
port/link/config
port/role
power/report_on_error
pptp/server/config
qos/config
reboot/timer
samba/config
snapshot/config
switch/jumbo_frame/config
switch/mirror/config
switch/trunk/config
system/name
syslog/email/config
tethering/config
time/config
torrent/config
ui/lang/config
upnp/config
url/config
urlredir/config
usb/mode
`.trim().split('\n'));

function domainFor(method: string): string {
  const prefix = method.split('/')[0];
  if (['wireless'].includes(prefix)) return 'wireless';
  if (['easymesh'].includes(prefix)) return 'easymesh';
  if (['network', 'wan'].includes(prefix)) return 'network';
  if (['dhcpd'].includes(prefix)) return 'dhcp';
  if (['route', 'port', 'switch', 'macvlan', 'iptv'].includes(prefix)) return 'routing';
  if (['nat', 'dmz', 'portforward', 'upnp', 'conn'].includes(prefix)) return 'nat';
  if (['firewall', 'dos', 'geoip', 'url', 'urlredir', 'acl'].includes(prefix)) return 'security';
  if (['qos', 'diffserv'].includes(prefix)) return 'qos';
  if (['wg', 'pptp', 'l2tp', 'ppp', 'vpncli', 'mudfish'].includes(prefix)) return 'vpn';
  if (['ddns', 'cwmp', 'snmp', 'icc', 'assistance'].includes(prefix)) return 'remote';
  if (['usb', 'partition', 'samba', 'ftp', 'media', 'torrent', 'cupsd', 'nas', 'snapshot', 'btrfs', 'ext4', 'tethering'].includes(prefix)) return 'usb';
  if (['routine', 'history', 'historyd', 'hostscan', 'wol'].includes(prefix)) return 'automation';
  if (['admin', 'http', 'https', 'httpsd', 'cert', 'default'].includes(prefix)) return 'administration';
  if (['session', 'ui'].includes(prefix)) return 'session';
  return 'system';
}

function riskFor(method: string): Exclude<Risk, 'read'> {
  if (/^(?:admin|assistance|cert|http\/config|httpsd\/port|https\/cert|config\/(?:reset|restore)|firmware\/upgrade|partition\/(?:format|del)|reboot\/now|default\/admin)/.test(method)) return 'critical';
  if (/^(?:network\/interface|wireless\/(?:band|bss)|wl\/operation|easymesh|firewall|route|port\/role|port\/link|switch|macvlan|iptv|nat|dmz|geoip|url)/.test(method)) return 'connectivity';
  return 'reversible';
}

function operationName(method: string): string {
  return method.replaceAll('/', '.');
}

const readbackAliases: Record<string, string> = {
  'acl/show': 'acl/config',
  'dhcpd/config': 'dhcpd/config/get',
  'firewall/config': 'firewall/get',
  'firewall/rule/show': 'firewall/get',
  'network/dns/cache/show': 'network/dns/info',
  'network/arp/show': 'network/info',
  'port/link/info': 'port/link/status',
  'port/role/info': 'port/role',
  'port/stat/info': 'port/stat/get',
  'portforward/show': 'portforward/get',
  'url/show': 'url/config',
  'urlredir/show': 'urlredir/config',
  'vpncli/show': 'vpncli/server/list',
  'vpncli/status': 'vpncli/status/list',
  'wg/server/config': 'wg/server/show',
  'wol/show': 'wol/show',
};

const specs: OperationSpec[] = [];
for (const [domain, methods] of Object.entries(readGroups)) {
  for (const method of methods) if (observedIux3Methods.has(method) && !actionWrites.has(method)) specs.push({ operation: operationName(method), method, domain, mode: 'read', risk: 'read', description: descriptions[method] ?? `Read ${method}` });
}
for (const [domain, methods] of Object.entries(writeGroups)) {
  for (const [method, risk, readback] of methods) if (observedIux3Methods.has(method)) specs.push({ operation: operationName(method), method, domain, mode: 'write', risk, readback: readback ? (readbackAliases[readback] ?? readback) : undefined, description: descriptions[method] ?? `Change ${method}` });
}

const represented = new Set(specs.map((spec) => `${spec.mode}:${spec.method}`));
for (const method of observedIux3Methods) {
  const mode = actionWrites.has(method) ? 'write' : 'read';
  if (!represented.has(`${mode}:${method}`)) {
    specs.push({ operation: operationName(method), method, domain: domainFor(method), mode, risk: mode === 'read' ? 'read' : riskFor(method), description: mode === 'read' ? `Read ${method}` : `Change ${method}` });
  }
}
for (const method of sharedConfigWrites) {
  specs.push({ operation: `${operationName(method)}.update`, method, domain: domainFor(method), mode: 'write', risk: riskFor(method), readback: method, description: `Update ${method}` });
}

const parameterMetadata: Record<string, Pick<OperationSpec, 'paramsHint' | 'defaultParams'>> = {
  'system/temperature': { paramsHint: 'Temperature sensor name, normally "cpu"', defaultParams: 'cpu' },
  'network/info': { paramsHint: 'Array of requested fields, for example ["extern_addr"]', defaultParams: ['extern_addr'] },
  'dhcpd/config/get': { paramsHint: 'Network tag, normally "lan"', defaultParams: 'lan' },
  'dhcpd/status': { paramsHint: 'Network tag, normally "lan"', defaultParams: 'lan' },
  'dhcpd/lease/show': { paramsHint: 'Optional network tag such as "lan"' },
  'dhcpd/reservedaddr/show': { paramsHint: 'Network tag, normally "lan"', defaultParams: 'lan' },
  'wireless/channel/list': { paramsHint: 'Band identifier returned by wireless.band.show, such as "2g" or "5g"' },
  'ddns/config': { paramsHint: 'DDNS provider name, normally "iptime"', defaultParams: 'iptime' },
  'ddns/status/get': { paramsHint: 'Configured FQDN or service name' },
  'nas/user/show': { paramsHint: 'Object with service, for example {"service":"ftp"}' },
  'routine/expire': { paramsHint: 'Array of routine identifiers to expire' },
};
for (const spec of specs) Object.assign(spec, parameterMetadata[spec.method] ?? {});

export const OPERATION_CATALOG = Object.freeze(specs);
export const OPERATION_MAP = new Map(OPERATION_CATALOG.map((spec) => [spec.operation, spec]));

export function operationSpec(operation: string, expectedMode?: 'read' | 'write'): OperationSpec {
  const spec = OPERATION_MAP.get(operation);
  if (!spec || (expectedMode && spec.mode !== expectedMode)) throw new IptimeError(`Unknown ${expectedMode ?? ''} operation: ${operation}`.trim(), 'UNKNOWN_OPERATION');
  return spec;
}

export function validateParams(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new IptimeError('params must be valid JSON', 'INVALID_PARAMS');
  if (serialized.length > 128_000) throw new IptimeError('params are too large', 'INVALID_PARAMS');
  if (/"(?:__proto__|prototype|constructor)"\s*:/.test(serialized)) throw new IptimeError('Unsafe parameter key', 'INVALID_PARAMS');
  return value as JsonValue;
}

export function catalogSummary(): Record<string, { read: number; write: number }> {
  const result: Record<string, { read: number; write: number }> = {};
  for (const spec of OPERATION_CATALOG) {
    const group = result[spec.domain] ??= { read: 0, write: 0 };
    group[spec.mode] += 1;
  }
  return result;
}
