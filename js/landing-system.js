import { AutomationDemo } from './automation-demo-model.js?v=20261101-auto';
(() => {
    const NS = 'http://www.w3.org/2000/svg';
    const root = document.querySelector('[data-flow-demo]');
    if (!root) return;
    const scene = root.querySelector('#nx-flow-scene');
    const workers = document.getElementById('nx-flow-workers');
    const colors = ['#57bdff','#a48bff','#cf8bff'];
    const positions = [200,480,760];
    const spriteUrl='/assets/mascota/nex-work.webp';
    function bot(index){
        const group=document.createElementNS(NS,'g');group.setAttribute('transform',`translate(${positions[index]},333)`);group.dataset.mascot='NEX';
        group.innerHTML=`<ellipse cx="0" cy="65" rx="58" ry="5" fill="${colors[index]}" opacity=".08"/><svg data-nex-sprite x="-96" y="-144" width="192" height="208" viewBox="0 0 192 208" overflow="hidden"><image href="${spriteUrl}" width="1536" height="416"/></svg>`;
        workers.append(group);return group;
    }
    const bots=positions.map((_,i)=>bot(i));
    const frames=bots.map(bot=>bot.querySelector('[data-nex-sprite]'));
    const galaxy=document.createElement('div');galaxy.className='nx-galaxy';galaxy.setAttribute('aria-hidden','true');
    const sky=document.createElementNS(NS,'svg');sky.setAttribute('viewBox','0 0 1440 1000');sky.setAttribute('preserveAspectRatio','none');
    let seed=37;const random=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    for(let i=0;i<40;i++){const star=document.createElementNS(NS,'circle');star.setAttribute('cx',String(random()*1440));star.setAttribute('cy',String(random()*1000));star.setAttribute('r',String(.45+random()*.85));star.setAttribute('fill','#d0d5ee');star.setAttribute('opacity',String(.18+random()*.32));sky.append(star);}
    galaxy.append(sky);document.body.prepend(galaxy);
    const tasksLayer=scene.querySelector('#nx-flow-tasks');
    const demo=new AutomationDemo(Math.floor(Math.random()*2147483646));
    const sprites=new Map(),queue=root.querySelector('[data-auto-queue]'),results=root.querySelector('[data-auto-results]');
    const pause=root.querySelector('[data-motion-toggle]'),status=root.querySelector('[data-flow-status]');
    const roles=[...root.querySelectorAll('[data-flow-role]')];
    let elapsed=0,lastTime=null,lastDraw=-1,raf=0,signature='',userPaused=false,visible=false;
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    const lerp=(a,b,t)=>a+(b-a)*t;
    const captions={incoming:'Recibiendo',working:'En proceso',waiting:'Esperando al siguiente bot',transferring:'Pasando información',queued:'En espera',complete:'Lista'};
    function sprite(job){
        const g=document.createElementNS(NS,'g');g.setAttribute('color',job.color);g.dataset.taskType=job.type;g.dataset.route=job.route.join('-');
        const icon=job.type==='agenda'?'<rect x="-12" y="-10" width="24" height="21" rx="3"/><path d="M-12-4h24M-6-13v6M6-13v6M-6 2h4m5 0h4m-13 5h4"/>':job.type==='contenido'?'<rect x="-14" y="-10" width="28" height="21" rx="3"/><circle cx="-5" cy="-3" r="2"/><path d="m-11 8 7-7 5 5 4-4 6 6"/>':'<path d="M-10-13H5l6 6v20h-21ZM5-13v7h6M-5-2h11M-5 3h11M-5 8h6"/>';
        g.innerHTML=`<rect x="-24" y="-18" width="48" height="36" rx="6" fill="#111629" stroke="currentColor" stroke-width="1.4"/><g data-task-icon fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon}</g><g data-task-check opacity="0"><circle r="15" fill="#19132b" stroke="currentColor" stroke-width="1.5"/><path d="m-8 0 5 5 11-12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
        tasksLayer.append(g);const entry={g,icon:g.querySelector('[data-task-icon]'),check:g.querySelector('[data-task-check]')};sprites.set(job.id,entry);return entry;
    }
    function renderText(){
        const next=demo.jobs.map(job=>job.id+job.phase).join('|')+';'+demo.event.id;
        if(signature===next)return;signature=next;
        queue.replaceChildren();
        for(const job of demo.jobs.filter(job=>job.phase!=='complete')){
            const item=document.createElement('div');item.className='nx-auto-job';item.style.setProperty('--task-color',job.color);
            const title=document.createElement('span');title.textContent=job.title;
            const label=document.createElement('small');const names=['Atención','Coordinación','Preparación'];label.textContent=job.phase==='queued'?captions.queued:job.phase==='transferring'?`${names[job.route[job.stage]]} → ${names[job.route[job.stage+1]]}`:`${names[job.route[job.stage]]} · ${captions[job.phase]}`;item.append(title,label);queue.append(item);
        }
        results.replaceChildren();
        if(!demo.recent.length){const item=document.createElement('li');item.className='nx-auto-pending';item.textContent='Preparando los primeros resultados…';results.append(item);}
        for(const result of demo.recent){const item=document.createElement('li');item.style.setProperty('--task-color',result.color);const check=document.createElement('span');check.textContent='✓';check.setAttribute('aria-hidden','true');item.append(check,document.createTextNode(result.result));results.append(item);}
        status.textContent=demo.event.text;
        roles.forEach((el,i)=>el.classList.toggle('is-active',demo.owners[i]!==null));
    }
    function draw(t){
        demo.step(t);renderText();
        const activeIds=new Set(demo.jobs.map(job=>job.id));
        for(const [id,entry]of sprites)if(!activeIds.has(id)){entry.g.remove();sprites.delete(id);}
        bots.forEach((bot,i)=>{
            const job=demo.jobs.find(task=>task.id===demo.owners[i]);
            let row=0,count=6,pace=3.2,clock=t+i*.71,state='waiting';
            if(job&&(job.phase==='working'||job.phase==='transferring')){
                row=1;count=6;pace=4.8;clock=t-job.since+i*.17;state='work';
            }
            const frame=Math.floor(clock*pace)%count;
            frames[i].setAttribute('viewBox',`${frame*192} ${row*208} 192 208`);bot.dataset.animation=state;
        });
        for(const job of demo.jobs){
            const entry=sprites.get(job.id)||sprite(job),g=entry.g;
            const bot=job.route[job.stage],pos=positions[bot],duration=job.until-job.since;
            let x=pos+58,y=265,scale=.76,opacity=1;
            entry.icon.setAttribute('opacity',job.phase==='complete'?'0':'1');entry.check.setAttribute('opacity',job.phase==='complete'?'1':'0');
            g.firstElementChild.setAttribute('opacity',job.phase==='complete'?'0':'1');
            if(job.phase==='queued'){opacity=0;}
            else if(job.phase==='incoming'){const k=smooth((t-job.since)/duration);x=lerp(pos-110,pos-55,k);y=lerp(209,295,k);opacity=Math.min(1,k*4);}
            else if(job.phase==='working'){y=262+Math.sin((t-job.since)*1.2+job.id)*2;}
            else if(job.phase==='waiting'){y=277;opacity=.65;}
            else if(job.phase==='transferring'){
                const target=positions[job.route[job.stage+1]],k=smooth((t-job.since)/duration);
                x=lerp(pos+58,target-58,k);y=292-Math.sin(k*Math.PI)*(target-pos>300?89:job.arc);scale=.9;
            }else if(job.phase==='complete'){const k=(t-job.since)/duration;x=pos+64;y=252-k*20;scale=.9+Math.sin(k*Math.PI)*.1;opacity=k>.75?(1-k)*4:1;}
            g.setAttribute('opacity',String(opacity));g.setAttribute('transform',`translate(${x},${y}) scale(${scale})`);g.dataset.state=job.phase;
        }
        scene.dataset.taskCount=String(demo.jobs.length);scene.dataset.completed=String(demo.recent.length);
    }
    function running(){return visible&&!userPaused&&!document.hidden;}
    function frame(now){raf=0;if(!running()){lastTime=null;return;}if(lastTime!==null)elapsed+=Math.min((now-lastTime)/1000,.1);lastTime=now;if(now-lastDraw>=32){draw(elapsed);lastDraw=now;}raf=requestAnimationFrame(frame);}
    function sync(){lastTime=null;if(running()&&!raf)raf=requestAnimationFrame(frame);else if(!running()&&raf){cancelAnimationFrame(raf);raf=0;}pause.textContent=userPaused?'Reproducir animación':'Pausar animación';pause.setAttribute('aria-pressed',String(userPaused));document.body.classList.toggle('nx-motion-paused',userPaused||document.hidden);scene.dataset.paused=String(!running());}
    pause.addEventListener('click',()=>{userPaused=!userPaused;sync();});
    if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.08}).observe(scene);else visible=true;
    document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',()=>{visible=false;sync();});
    window.addEventListener('pageshow',()=>{const rect=scene.getBoundingClientRect();visible=rect.bottom>0&&rect.top<innerHeight;sync();});
    draw(0);sync();
})();
