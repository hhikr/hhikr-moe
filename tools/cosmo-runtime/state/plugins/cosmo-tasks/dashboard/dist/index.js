(function () {
  const sdk = window.__HERMES_PLUGIN_SDK__;
  const R = sdk.React, h = R.createElement;
  function TasksPanel() {
    const [rules, setRules] = R.useState(null);
    const [tasks, setTasks] = R.useState([]);
    const [error, setError] = R.useState('');
    const refresh = () => Promise.all([
      sdk.fetchJSON('/api/plugins/cosmo-tasks/rules'),
      sdk.fetchJSON('/api/plugins/cosmo-tasks/tasks')
    ]).then(([r,t]) => {setRules(r);setTasks(t.tasks || []);setError('');}).catch(() => setError('无法读取，请确认当前登录有效并刷新。'));
    R.useEffect(() => {refresh();}, []);
    const download = async () => {
      try {
        const response = await sdk.authedFetch('/api/plugins/cosmo-tasks/download');
        if (!response.ok) throw new Error();
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a'); link.href = url; link.download = 'Cosmo-Focus-0.1.0.apk'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch (_) {setError('安装包下载失败，请确认登录状态。');}
    };
    return h('div', {style:{padding:24,maxWidth:760}},
      h('h2',null,'Cosmo · 任务与手机执行状态'),
      h('p',null,'一个 Cosmo，共享任务记录；定时卡片只投递到任务通知话题。'),
      error && h('p',{role:'alert'},error),
      rules ? h('section',null,
        h('h3',null,'Bilibili 前台限制'),
        h('p',null,'今日额度：'+rules.daily_limit_minutes+' 分钟；'+rules.blocked_window.start+'–'+rules.blocked_window.end+' 限制可见界面，后台音频不计时。'),
        h('p',null,rules.enforcement_status === 'owner_verified_device_report' ? '设备近期上报：本人已验收且执行服务开启。' : '手机执行尚未验证／近期没有有效上报，不能宣称正在拦截。'),
        h('p',null,'过期处罚不延续，疾病、请假和未知结果不自动处罚。')) : h('p',null,'正在读取真实状态…'),
      h('button',{onClick:refresh},'刷新状态'), ' ', h('button',{onClick:download},'下载 Android 执行端'),
      h('h3',null,'任务实例'),
      ...tasks.slice(-12).reverse().map(task => h('p',{key:task.id},
        task.date+' · '+(task.title || task.id)+' · '+({completed:'已完成',pending:task.started===false?'尚未启动':'进行中',awaiting_confirmation:'待核实',medical_hold:'恢复优先',failed:'已确认失败'}[task.status] || '待核实'))));
  }
  window.__HERMES_PLUGINS__.register('cosmo-tasks', TasksPanel);
})();
