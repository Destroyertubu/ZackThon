import {clamp,segmentDistance} from './math.js';

// Shared by the main thread and geometry worker; functions never cross postMessage.
export function terrainFunctions(nodes,links){
 const clearance=(x,z)=>Math.min(Math.hypot(x,z)-9,...nodes.map(n=>Math.hypot(x-n.position.x,z-n.position.z)-8),...links.map(l=>segmentDistance(x,z,l.waypoints[0],l.waypoints.at(-1))-3.5));
 const height=(x,z)=>Math.max(0,Math.sin(x*.055+1)*Math.cos(z*.052)*3.3+Math.sin(x*.11+z*.07)*1.5)*clamp(clearance(x,z)/15,0,1);
 return {clearance,height};
}
