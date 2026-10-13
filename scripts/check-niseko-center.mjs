import * as THREE from "three";
// Console check: Niseko single point exit centre, short way slerp near 140E, the old
// Imported journey centroid (North America), and a dateline trip centre via unit vectors.
// Run: node scripts/check-niseko-center.mjs
const v=(lat,lon)=>{const phi=THREE.MathUtils.degToRad(90-lat),th=THREE.MathUtils.degToRad(lon+180);return new THREE.Vector3(-Math.sin(phi)*Math.cos(th),Math.cos(phi),Math.sin(phi)*Math.sin(th));};
const ll=(p)=>{const lat=90-THREE.MathUtils.radToDeg(Math.acos(p.y));let lon=THREE.MathUtils.radToDeg(Math.atan2(p.z,-p.x))-180;if(lon<-180)lon+=360;return [lat,lon];};
const nis=v(42.8048,140.6874);
console.log('point exit centre', ll(nis).map(x=>x.toFixed(4)));
// tilted camera currently looking near Niseko but east of dateline-ish start, check short way
for (const startLon of [150, 179.9, -175]) {
  const a=v(40,startLon); const q=new THREE.Quaternion().setFromUnitVectors(a,nis);
  const mid=a.clone().applyQuaternion(new THREE.Quaternion().slerp(q,0.5));
  console.log('from',startLon,'angle deg',THREE.MathUtils.radToDeg(a.angleTo(nis)).toFixed(2),'mid lon',ll(mid)[1].toFixed(2));
}
const imported=[[35.6762,139.6503],[42.8048,140.6874],[40.7,-74],[21.16,-86.85]].map(([a,b])=>v(a,b));
const c=imported.reduce((s,p)=>s.add(p),new THREE.Vector3()).normalize();
console.log('old (journey centroid) exit centre',ll(c).map(x=>x.toFixed(2)));
const fiji=[[-17.7,178],[-16.5,-179.9],[-18.1,179.5]].map(([a,b])=>v(a,b)).reduce((s,p)=>s.add(p),new THREE.Vector3()).normalize();
console.log('dateline trip centre (unit vectors)',ll(fiji).map(x=>x.toFixed(2)),'vs lat/lng mean lon',((178-179.9+179.5)/3).toFixed(2));
