import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={metadataBase:new URL('https://closecall.43.167.174.154.nip.io'),title:'收盘见 CloseCall｜你的判断，收盘对答案',description:'人类与 AI 独立预测，封存证据，用真实美股与股票永续行情到期核验。',openGraph:{title:'收盘见 CloseCall',description:'你说会涨？留下判断，收盘见。',images:['/art/arena.jpg']}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
