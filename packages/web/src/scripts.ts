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
