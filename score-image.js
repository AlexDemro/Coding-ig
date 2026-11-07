import sharp from 'sharp';
// Flatten yellowed paper before enlargement. This changes contrast, not notation.
export async function prepareScoreImage(buffer,file){
 const source=sharp(buffer,{limitInputPixels:40000000,failOn:'error'}).rotate().flatten({background:'white'}),metadata=await source.metadata(),stats=await source.stats();
 const means=stats.channels.slice(0,3).map(c=>c.mean),aged=means.length===3&&Math.max(...means)-Math.min(...means)>15;
 if(aged){
  const {data,info}=await source.grayscale().raw().toBuffer({resolveWithObject:true}),background=await sharp(data,{raw:info}).blur(18).raw().toBuffer(),clean=new Uint8Array(data.length);
  for(let i=0;i<data.length;i++)clean[i]=Math.max(0,Math.min(255,(Math.min(255,data[i]/Math.max(1,background[i])*255)-40)*255/170));
  await sharp(clean,{raw:info}).resize({width:Math.max(2400,Math.min(3200,info.width)),height:4800,fit:'inside'}).png().toFile(file);
 }else await source.resize({width:Math.max(1600,Math.min(2800,metadata.width||1600)),height:3600,fit:'inside'}).grayscale().normalize().png().toFile(file);
 return {aged,lowResolution:(metadata.width||0)<1000};
}
