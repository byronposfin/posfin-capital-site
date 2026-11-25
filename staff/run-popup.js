// Opens My tasks as a full-height side sheet. On a narrow screen it fills the page.
// The sheet loads /staff/tasks, which stays on this site. Nothing is sent from here.
(function () {
  var button = document.getElementById('my-tasks');
  if (!button || button.dataset.bound === '1') return;
  button.dataset.bound = '1';
  var style = document.createElement('style');
  style.textContent = '#task-sheet{position:fixed;inset:0;background:rgba(19,17,58,.35);z-index:40}#task-sheet[hidden]{display:none}#task-sheet .panel{position:absolute;top:0;right:0;height:100%;width:min(480px,100%);background:#F6F4EF;box-shadow:-8px 0 24px rgba(19,17,58,.18);display:flex;flex-direction:column}#task-sheet .bar{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#1C184F;color:#fff}#task-sheet button{min-height:44px;border-radius:999px;border:0;padding:8px 14px;font-weight:700}#task-sheet iframe{flex:1;width:100%;border:0;background:#fff}@media(max-width:720px){#task-sheet .panel{width:100%}}';
  document.head.appendChild(style);
  button.addEventListener('click', function () {
    var sheet = document.getElementById('task-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'task-sheet';
      sheet.hidden = true;
      sheet.innerHTML = '<div class="panel" role="dialog" aria-label="My tasks"><div class="bar"><strong>My tasks</strong><button type="button" id="task-sheet-close">Close</button></div><iframe src="/staff/tasks" title="My tasks"></iframe></div>';
      document.body.appendChild(sheet);
      sheet.querySelector('#task-sheet-close').addEventListener('click', function () { sheet.hidden = true; });
      sheet.addEventListener('click', function (event) { if (event.target === sheet) sheet.hidden = true; });
    }
    sheet.hidden = false;
  });
})();
