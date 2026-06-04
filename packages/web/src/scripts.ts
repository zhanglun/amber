export function getThemeSwitcherHtml(): string {
  return (
    `<div class="theme-switcher">` +
    `<button class="theme-btn" data-theme="minimal" title="极简" onclick="setTheme('minimal')"></button>` +
    `<button class="theme-btn" data-theme="warm" title="温暖" onclick="setTheme('warm')"></button>` +
    `<button class="theme-btn" data-theme="modern" title="现代" onclick="setTheme('modern')"></button>` +
    `<button class="theme-btn" data-theme="dark" title="暗色" onclick="setTheme('dark')"></button>` +
    `</div>`
  );
}

export function getThemeScriptHtml(): string {
  return `<script>
(function(){
  window.setTheme=function(t){localStorage.setItem('amber-theme',t);document.documentElement.setAttribute('data-theme',t);};
  var t=localStorage.getItem('amber-theme')||'minimal';
  document.documentElement.setAttribute('data-theme',t);
})();
</script>`;
}

export function getSearchBarHtml(): string {
  return `<div class="search-bar"><input id="search" type="search" placeholder="搜索标题或来源…" autocomplete="off"></div>`;
}

export function getListFilterScriptHtml(): string {
  return `<script>
(function(){
  var inp=document.getElementById('search');
  if(!inp)return;
  inp.addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    document.querySelectorAll('.item[data-title]').forEach(function(item){
      var match=!q||(item.getAttribute('data-title')||'').includes(q)||(item.getAttribute('data-host')||'').includes(q);
      item.style.display=match?'':'none';
    });
    document.querySelectorAll('[data-group]').forEach(function(group){
      var items=group.querySelectorAll('.item[data-title]');
      var n=0;
      items.forEach(function(i){if(i.style.display!=='none')n++;});
      group.style.display=n===0?'none':'';
      var el=group.querySelector('.count');
      if(el)el.textContent=n;
    });
  });
})();
</script>`;
}

export function getReaderHeaderScriptHtml(): string {
  return `<script>
(function(){
  var header=document.querySelector('.article-topbar');
  var title=document.querySelector('.article-title-anchor');
  if(!header||!title||!('IntersectionObserver' in window))return;
  var observer=new IntersectionObserver(function(entries){
    var visible=entries[0]&&entries[0].isIntersecting;
    header.classList.toggle('title-visible',!visible);
  },{threshold:0});
  observer.observe(title);
})();
</script>`;
}

export function getDeleteConfirmScriptHtml(): string {
  return `<script>
(function(){
  document.querySelectorAll('.delete-form').forEach(function(form){
    form.addEventListener('submit',function(event){
      var title=form.getAttribute('data-title')||'this capture';
      if(!window.confirm('删除「'+title+'」？')){
        event.preventDefault();
      }
    });
  });
})();
</script>`;
}

export function calcReadProgress(_scrollTop: number, _scrollHeight: number, _clientHeight: number): number { return 0; }
export function calcRemainingMinutes(_totalChars: number, _progress: number): number { return 0; }
export function getReaderEnhancementsScriptHtml(): string { return ''; }
export function getReadIndicatorScriptHtml(): string { return ''; }
