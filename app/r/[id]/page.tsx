import Arena from '@/app/Arena';export default async function Page({params}:{params:Promise<{id:string}>}){return <Arena initialId={(await params).id}/>;}
