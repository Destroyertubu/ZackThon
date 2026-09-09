export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const norm=(v)=>{let l=Math.hypot(...v)||1;return v.map(x=>x/l)};
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function multiply(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
export function perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
export function lookAt(eye,target){let z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
export function project(p,m){let [x,y,z]=p,w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,w]}
export function random(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let a=t;a=Math.imul(a^a>>>15,a|1);a^=a+Math.imul(a^a>>>7,a|61);return((a^a>>>14)>>>0)/4294967296}}
export function segmentDistance(x,z,a,b){let dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)}
export function segmentBox(a,b,box,pad=0){let tmin=0,tmax=1;for(let i=0;i<3;i++){let d=b[i]-a[i],low=box.min[i]-pad,high=box.max[i]+pad;if(Math.abs(d)<1e-8){if(a[i]<low||a[i]>high)return null}else{let t1=(low-a[i])/d,t2=(high-a[i])/d;if(t1>t2)[t1,t2]=[t2,t1];tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return null}}return tmin}
export function pathBetween(nodes,links,start,target){let prev=new Map([[start,null]]),queue=[start];for(let i=0;i<queue.length;i++){if(queue[i]===target)break;for(let l of links){let v=l.source===queue[i]?l.target:l.target===queue[i]?l.source:null;if(v&&!prev.has(v)){prev.set(v,queue[i]);queue.push(v)}}}if(!prev.has(target))return[];let out=[];for(let v=target;v;v=prev.get(v))out.unshift(nodes.find(n=>n.id===v)?.position);return out.filter(Boolean)}
