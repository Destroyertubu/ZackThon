import {cross,norm,sub} from './math.js';
export const color=s=>[parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255];
export class Geometry{
 constructor(){this.v=[];this.transform=null}
 point(p){if(!this.transform)return p;let {x,y,z,yaw}=this.transform,c=Math.cos(yaw),s=Math.sin(yaw);return[x+p[0]*c+p[2]*s,y+p[1],z-p[0]*s+p[2]*c]}
 tri(a,b,c,col){a=this.point(a);b=this.point(b);c=this.point(c);let n=norm(cross(sub(b,a),sub(c,a)));for(let p of [a,b,c])this.v.push(...p,...n,...col)}
 quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col)}
 box(x,y,z,w,h,d,col,yaw=0){let points=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,h,-d/2],[-w/2,h,-d/2],[-w/2,0,d/2],[w/2,0,d/2],[w/2,h,d/2],[-w/2,h,d/2]].map(([a,b,c])=>[x+a*Math.cos(yaw)+c*Math.sin(yaw),y+b,z-a*Math.sin(yaw)+c*Math.cos(yaw)]);for(let face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])this.quad(...face.map(i=>points[i]),col)}
 cylinder(x,y,z,r,h,col,segments=8,top=r,phase=0){for(let i=0;i<segments;i++){let a=phase+i*Math.PI*2/segments,b=phase+(i+1)*Math.PI*2/segments,A=[x+r*Math.cos(a),y,z+r*Math.sin(a)],B=[x+r*Math.cos(b),y,z+r*Math.sin(b)],C=[x+top*Math.cos(b),y+h,z+top*Math.sin(b)],D=[x+top*Math.cos(a),y+h,z+top*Math.sin(a)];this.quad(A,D,C,B,col);if(top>0)this.tri([x,y+h,z],C,D,col);this.tri([x,y,z],A,B,col)}}
 rock(x,y,z,r,col){this.cylinder(x,y,z,r,r*.65,col,6,r*.65,.2);this.cylinder(x,y+r*.65,z,r*.65,r*.45,col,6,.1,.2)}
 path(a,b,width,col,y=.045){let dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1,px=dz/l*width/2,pz=-dx/l*width/2;this.quad([a.x-px,y,a.z-pz],[b.x-px,y,b.z-pz],[b.x+px,y,b.z+pz],[a.x+px,y,a.z+pz],col)}
 data(){return new Float32Array(this.v)}
}
