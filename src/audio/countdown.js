export class Countdown{
 constructor({now=()=>performance.now(),set=(fn,ms)=>setTimeout(fn,ms),clear=id=>clearTimeout(id)}={}){Object.assign(this,{now,set,clear});this.active=false;}
 start(seconds,tick,done){if(this.active)return false;this.active=true;const end=this.now()+seconds*1000;const step=()=>{if(!this.active)return;const left=end-this.now();if(left<=0){this.active=false;tick('GO!');done();return;}tick(Math.ceil(left/1000));this.timer=this.set(step,Math.min(left,50));};step();return true;}
 cancel(){this.active=false;this.clear(this.timer);}
}
