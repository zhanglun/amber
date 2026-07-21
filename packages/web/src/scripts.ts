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

export function getSortToggleHtml(): string {
  return `<button class="sort-toggle" id="sort-toggle" type="button" title="切换排序" data-order="desc">最新 ▾</button>`;
}

export function getListFilterScriptHtml(): string {
  return `<script>
(function(){
  var inp=document.getElementById('search');
  var chips=document.querySelectorAll('.tag-filter[data-tag]');
  var allChip=document.querySelector('.tag-filter-all');
  var sortToggle=document.getElementById('sort-toggle');
  var sortOrder=(function(){try{return localStorage.getItem('amber-list-sort')||'desc';}catch(e){return 'desc';}})();
  if(sortToggle)sortToggle.setAttribute('data-order',sortOrder);
  var active=new Set();
  function itemTags(item){try{return JSON.parse(item.getAttribute('data-tags')||'[]');}catch(e){return [];}}
  function apply(){
    var q=((inp&&inp.value)||'').trim().toLowerCase();
    document.querySelectorAll('.item[data-title]').forEach(function(item){
      var title=item.getAttribute('data-title')||'';
      var host=item.getAttribute('data-host')||'';
      var tags=itemTags(item);
      var textOk=!q||title.indexOf(q)>=0||host.indexOf(q)>=0;
      var tagOk=active.size===0||tags.some(function(t){return active.has(t);});
      var shouldShow=textOk&&tagOk;
      var currentlyHidden=item.style.display==='none';
      if(shouldShow&&currentlyHidden){
        item.style.display='';
        item.classList.add('item-entering');
        requestAnimationFrame(function(){requestAnimationFrame(function(){item.classList.remove('item-entering');});});
      }else if(!shouldShow&&!currentlyHidden){
        item.style.display='none';
      }
    });
    sortVisible();
    document.querySelectorAll('[data-group]').forEach(function(group){
      var items=group.querySelectorAll('.item[data-title]');
      var n=0;items.forEach(function(i){if(i.style.display!=='none')n++;});
      group.style.display=n===0?'none':'';
      var el=group.querySelector('.count');
      if(el)el.textContent=n;
    });
  }
  function sortVisible(){
    document.querySelectorAll('[data-group]').forEach(function(group){
      var items=Array.prototype.slice.call(group.querySelectorAll('.item[data-title]'));
      items.sort(function(a,b){
        var av=a.getAttribute('data-captured-at')||'';
        var bv=b.getAttribute('data-captured-at')||'';
        return sortOrder==='desc'?bv.localeCompare(av):av.localeCompare(bv);
      });
      items.forEach(function(item){group.appendChild(item);});
    });
  }
  if(inp)inp.addEventListener('input',apply);
  if(sortToggle){
    sortToggle.addEventListener('click',function(){
      sortOrder=sortOrder==='desc'?'asc':'desc';
      sortToggle.setAttribute('data-order',sortOrder);
      sortToggle.textContent=sortOrder==='desc'?'最新 ▾':'最早 ▴';
      try{localStorage.setItem('amber-list-sort',sortOrder);}catch(e){}
      apply();
    });
  }
  chips.forEach(function(chip){
    chip.addEventListener('click',function(){
      var t=chip.getAttribute('data-tag');
      if(active.has(t)){active.delete(t);chip.classList.remove('active');}
      else{active.add(t);chip.classList.add('active');}
      if(allChip)allChip.classList.toggle('active',active.size===0);
      apply();
    });
  });
  if(allChip){
    allChip.classList.add('active');
    allChip.addEventListener('click',function(){
      active.clear();
      chips.forEach(function(c){c.classList.remove('active');});
      allChip.classList.add('active');
      apply();
    });
  }
  apply();
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

export function calcReadProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const max = scrollHeight - clientHeight;
  return max > 0 ? Math.min(100, Math.max(0, Math.round((scrollTop / max) * 100))) : 0;
}

export function calcRemainingMinutes(totalChars: number, progress: number): number {
  if (totalChars === 0) return 0;
  return Math.max(0, Math.round((totalChars * (1 - progress / 100)) / 300));
}

export function getReaderEnhancementsScriptHtml(opts: { hasPrev?: boolean; hasNext?: boolean } = {}): string {
  const hasPrev = opts.hasPrev !== false;
  const hasNext = opts.hasNext !== false;
  return `<script>
(function(){
  var shell=document.querySelector('.article-shell');
  if(!shell)return;
  var captureId=shell.dataset.captureId||'';
  var savedProgress=parseInt(shell.dataset.readProgress||'0',10);
  var totalChars=parseInt(shell.dataset.totalChars||'0',10);

  if(savedProgress>0&&savedProgress<95){
    requestAnimationFrame(function(){
      var max=document.documentElement.scrollHeight-window.innerHeight;
      window.scrollTo({top:max*savedProgress/100,behavior:'instant'});
    });
  }

  var FONT_KEY='amber-font-size';
  var initSize=parseInt(localStorage.getItem(FONT_KEY)||'16',10);
  function applyFontSize(size){
    document.documentElement.style.setProperty('--font-size-article',size+'px');
    localStorage.setItem(FONT_KEY,String(size));
  }
  if([14,16,18,20].indexOf(initSize)!==-1)applyFontSize(initSize);
  document.querySelectorAll('.font-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var cur=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--font-size-article')||'16',10);
      applyFontSize(Math.min(20,Math.max(14,cur+(btn.dataset.dir==='up'?2:-2))));
    });
  });

  document.querySelectorAll('pre').forEach(function(pre){
    if(pre.classList.contains('github-dark'))return;
    var wrap=document.createElement('div');
    wrap.className='code-block';
    if(!pre.parentNode)return;
    pre.parentNode.insertBefore(wrap,pre);
    wrap.appendChild(pre);
    var lang=pre.dataset.language;
    if(lang){var sp=document.createElement('span');sp.className='code-lang';sp.textContent=lang;wrap.insertBefore(sp,pre);}
    var btn=document.createElement('button');
    btn.className='copy-btn';btn.textContent='Copy';
    btn.addEventListener('click',function(){
      navigator.clipboard.writeText(pre.textContent||'').then(function(){
        btn.textContent='Copied!';btn.classList.add('copied');
        setTimeout(function(){btn.textContent='Copy';btn.classList.remove('copied');},1500);
      });
    });
    wrap.appendChild(btn);
  });

  var headings=Array.from(document.querySelectorAll('h2[id],h3[id]'));
  var tocItems={};
  document.querySelectorAll('.toc .toc-item').forEach(function(item){
    var a=item.querySelector('a');
    var href=a&&a.getAttribute('href');
    if(href&&href.startsWith('#'))tocItems[href.slice(1)]=item;
  });
  var activeId=null;
  function updateTocActive(){
    var threshold=window.scrollY+window.innerHeight*0.3;
    var cur=null;
    headings.forEach(function(h){if(h.getBoundingClientRect().top+window.scrollY<=threshold)cur=h.id;});
    if(cur!==null&&cur!==activeId){
      if(activeId&&tocItems[activeId])tocItems[activeId].classList.remove('active');
      activeId=cur;
      var item=tocItems[activeId];
      if(item){item.classList.add('active');item.scrollIntoView({behavior:'smooth',block:'nearest'});}
    }
  }

  var progressFill=document.querySelector('.read-progress-fill');
  var remainingEl=document.querySelector('.meta-remaining');
  var scrollTopBtn=document.querySelector('.scroll-top-btn');
  var rafPending=false;
  var saveTimer=null;

  window.addEventListener('scroll',function(){
    if(rafPending)return;
    rafPending=true;
    requestAnimationFrame(function(){
      rafPending=false;
      var max=document.documentElement.scrollHeight-window.innerHeight;
      var p=max>0?Math.round(window.scrollY/max*100):0;
      if(progressFill)progressFill.style.width=p+'%';
      if(remainingEl&&totalChars>0){
        var mins=Math.max(0,Math.round(totalChars*(1-p/100)/300));
        remainingEl.textContent=p<5?('约'+Math.round(totalChars/300)+'分钟'):mins===0?'快读完了':('还剩约'+mins+'分钟');
      }
      if(scrollTopBtn){var show=window.scrollY>300;scrollTopBtn.style.opacity=show?'1':'0';scrollTopBtn.style.pointerEvents=show?'auto':'none';}
      updateTocActive();
      if(captureId){
        clearTimeout(saveTimer);
        saveTimer=setTimeout(function(){
          var body={readProgress:p};
          if(p>=95)body.readAt=new Date().toISOString();
          fetch('/captures/'+captureId+'/read',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(function(){});
        },2000);
      }
    });
  },{passive:true});

  if(scrollTopBtn)scrollTopBtn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});

  ${hasPrev ? `var prevLink=document.querySelector('a[data-nav="prev"]');` : ''}
  ${hasNext ? `var nextLink=document.querySelector('a[data-nav="next"]');` : ''}
  document.addEventListener('keydown',function(e){
    var tag=(document.activeElement||{}).tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key==='j')window.scrollBy({top:200,behavior:'smooth'});
    else if(e.key==='k')window.scrollBy({top:-200,behavior:'smooth'});
    else if(e.key==='Escape')window.location.href='/';
    ${hasPrev ? `else if(e.key==='['&&prevLink)window.location.href=prevLink.href;` : ''}
    ${hasNext ? `else if(e.key===']'&&nextLink)window.location.href=nextLink.href;` : ''}
  });
})();
</script>`;
}

export function getReadIndicatorScriptHtml(): string {
  return `<script>
(function(){
  document.querySelectorAll('.item[data-read-progress]').forEach(function(item){
    var progress=parseInt(item.getAttribute('data-read-progress')||'0',10);
    var readAt=item.getAttribute('data-read-at')||'';
    var dot=document.createElement('span');
    dot.className='read-indicator';
    if(readAt){dot.classList.add('read');}
    else if(progress>0){dot.classList.add('in-progress');dot.textContent=progress+'%';}
    else{dot.classList.add('unread');}
    var main=item.querySelector('.item-main');
    if(main)item.insertBefore(dot,main);
    if(readAt){var link=main&&main.querySelector('a');if(link)link.classList.add('title-read');}
  });
})();
</script>`;
}

/** 列表筛选判定：标签按精确成员 OR，搜索文本按标题/来源子串，二者 AND。 */
export function tagFilterMatch(
  itemTags: string[],
  activeTags: string[],
  query: string,
  title: string,
  host: string,
): boolean {
  const q = query.trim().toLowerCase();
  const textOk =
    q === "" ||
    title.toLowerCase().includes(q) ||
    host.toLowerCase().includes(q);
  const tagOk =
    activeTags.length === 0 || activeTags.some((t) => itemTags.includes(t));
  return textOk && tagOk;
}

export function getTagEditorScriptHtml(): string {
  return `<script>
(function(){
  function tagsOf(editor){
    return Array.prototype.map.call(
      editor.querySelectorAll('.tag-chip[data-tag]'),
      function(c){return c.getAttribute('data-tag');}
    );
  }
  function save(id,tags){
    return fetch('/captures/'+encodeURIComponent(id)+'/tags',{
      method:'PATCH',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({tags:tags})
    }).catch(function(){});
  }
  function makeChip(tag){
    var span=document.createElement('span');
    span.className='tag-chip';
    span.setAttribute('data-tag',tag);
    span.textContent=tag;
    var btn=document.createElement('button');
    btn.className='tag-remove';
    btn.type='button';
    btn.title='移除';
    btn.textContent='×';
    span.appendChild(btn);
    return span;
  }
  document.querySelectorAll('.tag-editor[data-capture-id]').forEach(function(editor){
    var id=editor.getAttribute('data-capture-id');
    editor.addEventListener('click',function(ev){
      var t=ev.target;
      if(t.classList&&t.classList.contains('tag-remove')){
        var chip=t.parentNode;
        chip.parentNode.removeChild(chip);
        save(id,tagsOf(editor));
        return;
      }
      if(t.classList&&t.classList.contains('tag-add')){
        var name=window.prompt('新标签');
        if(!name)return;
        name=name.trim();
        if(!name||tagsOf(editor).indexOf(name)>=0)return;
        editor.insertBefore(makeChip(name),t);
        save(id,tagsOf(editor));
      }
    });
  });
})();
</script>`;
}
