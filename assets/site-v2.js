(function(){
  var standardNav=document.getElementById('nav')||document.querySelector('.site-header nav[id]');
  if(standardNav){
    standardNav.innerHTML='<ul>'+
      '<li><a href="work.html">Our work</a></li>'+
      '<li><a href="technology.html">Technology</a></li>'+
      '<li><a href="service-corps.html">Service Corps</a></li>'+
      '<li><a href="evidence.html">Progress</a></li>'+
      '<li><a href="about.html">About</a></li>'+
      '<li><a href="partners.html">Partner</a></li>'+
      '<li><a class="btn btn-dark" href="https://www.every.org/food-aid-project#/donate">Donate</a></li>'+
    '</ul>';
  }

  document.querySelectorAll('.nav-toggle,.atlas-menu').forEach(function(button){
    button.addEventListener('click',function(){
      var nav=document.getElementById(button.getAttribute('aria-controls'));
      if(!nav)return;
      var open=nav.classList.toggle('open');
      button.setAttribute('aria-expanded',String(open));
      button.setAttribute('aria-label',open?'Close menu':'Open menu');
    });
  });

  document.querySelectorAll('nav a').forEach(function(link){
    var current=window.location.pathname.split('/').pop()||'index.html';
    var target=(link.getAttribute('href')||'').split('#')[0];
    if(target===current)link.setAttribute('aria-current','page');
    link.addEventListener('click',function(){
      var nav=link.closest('nav');
      if(nav&&nav.classList.contains('open')){
        nav.classList.remove('open');
        var button=document.querySelector('[aria-controls="'+nav.id+'"]');
        if(button)button.setAttribute('aria-expanded','false');
      }
    });
  });

  document.querySelectorAll('[data-year]').forEach(function(node){node.textContent=new Date().getFullYear()});

  var revealNodes=document.querySelectorAll('[data-reveal]');
  if(revealNodes.length){
    if('IntersectionObserver'in window&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      var revealObserver=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target)}
        });
      },{rootMargin:'0px 0px -8% 0px',threshold:.08});
      revealNodes.forEach(function(node){revealObserver.observe(node)});
    }else{revealNodes.forEach(function(node){node.classList.add('is-visible')})}
  }

  var siteHeader=document.querySelector('[data-site-header]');
  if(siteHeader){
    var updateHeader=function(){siteHeader.classList.toggle('is-scrolled',window.scrollY>24)};
    updateHeader();
    window.addEventListener('scroll',updateHeader,{passive:true});
  }

  var jumpLinks=document.querySelectorAll('.fap-jump a[href^="#"]');
  if(jumpLinks.length&&'IntersectionObserver'in window){
    var jumpTargets=[];
    jumpLinks.forEach(function(link){
      var target=document.querySelector(link.getAttribute('href'));
      if(target)jumpTargets.push(target);
    });
    var jumpObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          jumpLinks.forEach(function(link){link.classList.toggle('is-active',link.getAttribute('href')==='#'+entry.target.id)});
        }
      });
    },{rootMargin:'-28% 0px -62% 0px',threshold:0});
    jumpTargets.forEach(function(target){jumpObserver.observe(target)});
  }

  document.querySelectorAll('.fap-program-list details').forEach(function(detail){
    detail.addEventListener('toggle',function(){
      if(!detail.open)return;
      document.querySelectorAll('.fap-program-list details[open]').forEach(function(other){if(other!==detail)other.open=false});
    });
  });
})();
