import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {isIP} from 'node:net';

const args = process.argv.slice(2);
const command = args[0];
const option = name => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const domain = 'hhikr.moe';

async function main() {
  if (!['list', 'point'].includes(command) || !option('--key-file')) {
    console.log('用法：node scripts/namesilo-dns.mjs list --key-file <凭据文件>');
    console.log('配置解析：node scripts/namesilo-dns.mjs point --key-file <凭据文件> --ip <服务器IPv4>');
    process.exitCode = 1;
    return;
  }
  const key = (await readFile(option('--key-file'), 'utf8')).trim();
  if (!key || /\s/.test(key)) throw new Error('API Key 文件应只包含密钥。');
  async function api(operation, parameters = {}) {
    const url = new URL(`https://www.namesilo.com/api/${operation}`);
    url.search = new URLSearchParams({version:'1', type:'json', key, domain, ...parameters});
    let response;
    try {
      response = await fetch(url, {signal:AbortSignal.timeout(30000)});
    } catch {
      throw new Error('NameSilo API 连接失败，请检查网络和 API 来源 IP 限制。');
    }
    if (!response.ok) throw new Error(`NameSilo API HTTP ${response.status}`);
    const data = await response.json();
    if (Number(data.reply?.code) !== 300) {
      throw new Error(`NameSilo 操作失败，返回代码 ${data.reply?.code ?? '未知'}。`);
    }
    return data.reply;
  }
  const reply = await api('dnsListRecords');
  const records = Array.isArray(reply.resource_record) ? reply.resource_record : reply.resource_record ? [reply.resource_record] : [];
  if (command === 'list') {
    console.log(JSON.stringify(records.filter(record => ['A','AAAA','CNAME','MX','CAA'].includes(record.type)), null, 2));
    return;
  }
  const ip = option('--ip');
  if (isIP(ip ?? '') !== 4) throw new Error('--ip 必须是服务器 IPv4 地址。');
  const targets = ['', 'www'];
  const fullHost = host => host ? `${host}.${domain}` : domain;
  const selected = host => records.filter(record => {
    const value = String(record.host ?? '').replace(/\.$/, '');
    return value === fullHost(host) || value === host || (!host && value === '@');
  });
  for (const host of targets) {
    const related = selected(host);
    if (related.some(record => record.type === 'AAAA')) {
      throw new Error(`${fullHost(host)} 有 IPv6 解析，需先确认新服务器 IPv6，避免部分访问者连到旧服务器。`);
    }
    if (related.some(record => record.type === 'CNAME')) {
      throw new Error(`${fullHost(host)} 已有 CNAME，需先审查现有目标后决定迁移方式。`);
    }
  }
  await mkdir('.deployment', {recursive:true});
  await writeFile(`.deployment/namesilo-before-${Date.now()}.json`, JSON.stringify({domain, records}, null, 2), {mode:0o600});
  for (const host of targets) {
    const current = selected(host).filter(record => record.type === 'A');
    if (!current.length) {
      await api('dnsAddRecord', {rrtype:'A', rrhost:host, rrvalue:ip, rrttl:'3600'});
    } else {
      const [record, ...extra] = current;
      if (record.value !== ip) {
        await api('dnsUpdateRecord', {rrid:record.record_id, rrhost:host, rrvalue:ip, rrttl:'3600'});
      }
      for (const duplicate of extra) await api('dnsDeleteRecord', {rrid:duplicate.record_id});
    }
    console.log(`${fullHost(host)} 已指向 ${ip}`);
  }
  console.log('解析修改完成；DNS 缓存仍需时间更新。');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
