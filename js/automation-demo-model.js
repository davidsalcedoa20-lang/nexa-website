// Simulación visual local: no consulta ni modifica cuentas o datos reales.
const CATALOG = [
    { type:'agenda', title:'Una reunión con un cliente', route:[0,1,2], result:'Cita agendada', color:'#65c5ff' },
    { type:'contenido', title:'Una pieza para redes', route:[1,2], result:'Contenido preparado', color:'#c18bff' },
    { type:'factura', title:'Datos de facturación', route:[0,2], result:'Datos de factura listos', color:'#94b0ff' },
    { type:'agenda', title:'Un cambio de horario', route:[0,2], result:'Horario actualizado', color:'#65c5ff' },
    { type:'contenido', title:'El calendario de contenido', route:[0,1,2], result:'Publicación programada', color:'#c18bff' },
    { type:'factura', title:'Un documento administrativo', route:[1,2], result:'Documento organizado', color:'#94b0ff' }
];
const ROLES = ['Atención','Coordinación','Preparación'];

export class AutomationDemo {
    constructor(seed=37) {
        this.seed=(Math.abs(seed)%2147483646)+1;
        this.jobs=[];this.owners=[null,null,null];this.recent=[];
        this.nextArrival=0;this.serial=0;this.bag=[];this.lastType='';
        this.event={id:0,text:'Las solicitudes llegan y avanzan automáticamente.'};
    }
    random(){this.seed=this.seed*16807%2147483647;return this.seed/2147483647;}
    announce(text){this.event={id:this.event.id+1,text};}
    choose(){
        if(!this.bag.length||this.bag.every(item=>item.type===this.lastType)){
            this.bag=[...CATALOG];
            for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
        }
        const index=this.bag.findIndex(item=>item.type!==this.lastType);
        const [item]=this.bag.splice(index,1);this.lastType=item.type;return item;
    }
    work(job,t){
        job.phase='working';job.since=t;
        job.until=t+job.workTimes[job.stage];
        this.announce(`${ROLES[job.route[job.stage]]} trabaja en ${job.title.toLowerCase()}.`);
    }
    step(t){
        this.jobs=this.jobs.filter(job=>job.phase!=='complete'||t<job.until);
        if(t>=this.nextArrival&&this.jobs.length<3){
            const item=this.choose();
            this.jobs.push({...item,id:++this.serial,stage:0,phase:'queued',since:t,until:t,
                workTimes:item.route.map((_,i)=>3.2+this.random()*2.2+(item.type==='contenido'&&i===item.route.length-1?1.1:0)),
                transferTime:1.7+this.random()*.7,arc:48+this.random()*16});
            this.nextArrival=t+6.5+this.random()*2.7;
            this.announce(`Llega ${item.title.toLowerCase()}.`);
        }
        for(const job of this.jobs){
            const bot=job.route[job.stage],next=job.route[job.stage+1];
            if(job.phase==='queued'&&this.owners[bot]===null){
                this.owners[bot]=job.id;job.phase='incoming';job.since=t;job.until=t+1.5;
                this.announce(`${ROLES[bot]} recibe ${job.title.toLowerCase()}.`);
            }
            if(job.phase==='incoming'&&t>=job.until)this.work(job,t);
            if(job.phase==='working'&&t>=job.until){
                if(next===undefined){
                    this.owners[bot]=null;job.phase='complete';job.since=t;job.until=t+2.8;
                    this.recent.unshift({id:job.id,type:job.type,title:job.title,result:job.result,color:job.color});
                    this.recent=this.recent.slice(0,3);this.announce(`${job.result}. La siguiente tarea continúa.`);
                }else{job.phase='waiting';job.since=t;}
            }
            if(job.phase==='waiting'&&this.owners[next]===null){
                this.owners[next]=job.id;job.phase='transferring';job.since=t;job.until=t+job.transferTime;
                this.announce(`${ROLES[bot]} pasa la información a ${ROLES[next]}.`);
            }
            if(job.phase==='transferring'&&t>=job.until){
                this.owners[bot]=null;job.stage++;this.work(job,t);
            }
        }
        return this;
    }
}
