import React,{useState,useRef,useEffect} from 'react';
const tracks=[{src:'/music/sanguo-flova-v1.mp3',name:'江岸春风',duration:'2:23'},{src:'/music/sanguo-flova-v2.mp3',name:'青山行舟',duration:'2:55'}];
export default function Music({ready=true}:{ready?:boolean}){
 const [track]=useState(()=>Math.floor(Math.random()*tracks.length)),[playing,setPlaying]=useState(false),[preparing,setPreparing]=useState(false),[error,setError]=useState(false);
 const canAutoPlay=useRef(ready);canAutoPlay.current=ready;
 const audio=useRef<HTMLAudioElement|null>(null),wantsPlay=useRef(true),generation=useRef(0),awaitingGesture=useRef(false);
 async function play(){const el=audio.current;if(!el)return;const request=++generation.current;setError(false);setPreparing(true);try{await el.play();awaitingGesture.current=false;}catch(e){if(request===generation.current){const blocked=e instanceof DOMException&&e.name==='NotAllowedError';awaitingGesture.current=blocked;setError(!blocked);if(!blocked)wantsPlay.current=false;setPreparing(false);}}}
 useEffect(()=>{const el=audio.current!;el.volume=.35;function gesture(e:Event){if((e.target as Element)?.closest?.('.music-controls'))return;if(wantsPlay.current&&awaitingGesture.current)void play();}document.addEventListener('pointerdown',gesture);document.addEventListener('keydown',gesture);function visibility(){if(document.hidden){generation.current++;el.pause();setPreparing(false);}else if(wantsPlay.current&&canAutoPlay.current){void play();}}document.addEventListener('visibilitychange',visibility);return()=>{document.removeEventListener('visibilitychange',visibility);document.removeEventListener('pointerdown',gesture);document.removeEventListener('keydown',gesture);generation.current++;el.pause();};},[]);
 useEffect(()=>{if(ready&&wantsPlay.current&&audio.current?.paused)void play();},[ready]);
 function toggle(){if(playing||preparing){wantsPlay.current=false;generation.current++;audio.current?.pause();setPreparing(false);}else{wantsPlay.current=true;void play();}}
 return <div className="music-controls">
 <audio ref={audio} src={tracks[track].src} loop preload="none" onPlaying={()=>{setPlaying(true);setPreparing(false);setError(false);}} onPause={()=>setPlaying(false)} onWaiting={()=>{if(wantsPlay.current)setPreparing(true);}} onError={()=>{setError(true);setPreparing(false);setPlaying(false);wantsPlay.current=false;}}/>
 <button className={'music-button '+(playing?'on':'')} aria-pressed={playing} onClick={toggle} title={tracks[track].name+' · 点击播放或暂停'}>{preparing?'Ⅱ 取消加载':error?'♫ 重试配乐':playing?'Ⅱ 暂停配乐':'♫ 开启配乐'}</button>

 </div>;
}
