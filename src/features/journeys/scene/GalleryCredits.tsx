const works = [
  ['莫奈 · 议会大厦，日落','https://www.nga.gov/artworks/46523-houses-parliament-sunset'],
  ['莫奈 · 黄昏的滑铁卢桥','https://www.nga.gov/artworks/61377-waterloo-bridge-london-dusk'],
  ['透纳 · 威尼斯海关与圣乔治教堂','https://www.nga.gov/artworks/1224-venice-dogana-and-san-giorgio-maggiore'],
]
export default function GalleryCredits() {
  return <details style={{position:'absolute',left:36,bottom:82,zIndex:3,color:'#f3e3c8',fontSize:11,maxWidth:'calc(100% - 72px)',background:'rgba(28,40,43,.75)',borderRadius:8,padding:'7px 10px',backdropFilter:'blur(8px)'}}>
    <summary style={{cursor:'pointer',letterSpacing:'.08em'}}>橱窗藏品 · National Gallery of Art</summary>
    <div style={{display:'grid',gap:7,padding:'10px 0 3px'}}>
      {works.map(([title,url])=><a key={url} href={url} target="_blank" rel="noreferrer" style={{color:'#edddc0'}}>{title} ↗</a>)}
      <span style={{fontSize:10,opacity:.78}}>公开藏品 · Courtesy National Gallery of Art, Washington · CC0</span>
    </div>
  </details>
}
