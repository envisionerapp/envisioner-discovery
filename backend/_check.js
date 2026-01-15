const{PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
  const t=await db.streamer.count();
  const r=await db.streamer.count({where:{region:{not:'OTHER'}}});
  const c=await db.streamer.count({where:{primaryCategory:{not:null},NOT:{primaryCategory:{contains:'unknown',mode:'insensitive'}}}});
  console.log('Total:',t,'Region:',r,'Category:',c);
  await db.$disconnect();
})();
