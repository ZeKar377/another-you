import {useEffect,useState} from 'react';
export default function StoryBackdrop({src,next,onReady}:{src:string;next?:string;onReady?:(ready:boolean)=>void}){
 const [layers,setLayers]=useState({current:'',previous:''});
 useEffect(()=>{let alive=true;const img=new Image();img.onload=()=>{if(alive){setLayers(old=>old.current===src?old:{current:src,previous:old.current});onReady?.(true);}};img.onerror=()=>{if(alive)onReady?.(true);};img.fetchPriority='high';img.src=src;return()=>{alive=false;};},[src]);
 useEffect(()=>{if(next&&layers.current===src){const img=new Image();img.fetchPriority='low';img.src=next;}},[next,layers.current,src]);
 return <div className="story-backdrop" aria-hidden="true" data-scene={layers.current}>
 {layers.previous&&<img className="backdrop-old" src={layers.previous} alt=""/>}
 {layers.current&&<img key={layers.current} className="backdrop-current" src={layers.current} alt=""/>}
 <div className="backdrop-wash"/>
 </div>;
}
