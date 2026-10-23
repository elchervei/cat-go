import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Cat, Check, ChevronRight, CircleHelp, Compass, Crown, ImagePlus, PawPrint, RotateCcw, Sparkles, Star, Trophy, UserRound, X, Zap, Heart, Shield, Footprints, Trash2, Download, Info } from 'lucide-react';
import './style.css';

const STORE_KEY = 'catgo_v1_cards';
const XP_KEY = 'catgo_v1_xp';
const MISSION_KEY = 'catgo_v1_missions';
const rarities = [
  { name: 'Обычный', color: '#8a9a86', bonus: 10 },
  { name: 'Необычный', color: '#52a88a', bonus: 20 },
  { name: 'Редкий', color: '#6b83df', bonus: 35 },
  { name: 'Эпический', color: '#a16bce', bonus: 60 },
  { name: 'Легендарный', color: '#e3a52f', bonus: 100 },
];
const names = ['Пушистый исследователь','Рыжий охотник','Сонный философ','Усатый путешественник','Хозяин дивана','Тихий наблюдатель','Солнечный комочек','Ночной прыгун'];
const traits = [
  { label:'Любопытство', icon: CircleHelp, min:35, max:99 },
  { label:'Ловкость', icon: Footprints, min:30, max:99 },
  { label:'Дружелюбие', icon: Heart, min:35, max:99 },
  { label:'Смелость', icon: Shield, min:25, max:99 },
];
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function pickRarity(){ const n=Math.random(); return n>.985?4:n>.92?3:n>.72?2:n>.38?1:0; }
function readJSON(key,fallback){ try { const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; } catch { return fallback; } }
function App(){
  const [tab,setTab] = useState('home');
  const [cards,setCards] = useState(()=>readJSON(STORE_KEY,[]));
  const [xp,setXp] = useState(()=>Number(localStorage.getItem(XP_KEY)||0));
  const [missions,setMissions] = useState(()=>readJSON(MISSION_KEY,{photo:0,days:0}));
  const [photo,setPhoto] = useState('');
  const [fileName,setFileName] = useState('');
  const [draft,setDraft] = useState(null);
  const [showInfo,setShowInfo] = useState(false);
  const [message,setMessage] = useState('');
  const inputRef = useRef(null);
  useEffect(()=>{ localStorage.setItem(STORE_KEY,JSON.stringify(cards)); },[cards]);
  useEffect(()=>{ localStorage.setItem(XP_KEY,String(xp)); },[xp]);
  useEffect(()=>{ localStorage.setItem(MISSION_KEY,JSON.stringify(missions)); },[missions]);
  const level = Math.floor(xp/100)+1;
  const nextXP = xp%100;
  const sortedCards = useMemo(()=>[...cards].sort((a,b)=>b.createdAt-a.createdAt),[cards]);
  
function startPhoto(){
  setPhoto('');
  setDraft(null);
  setTab('camera');
}

  function onFile(e){
    const f=e.target.files?.[0]; if(!f) return;
    if(!f.type.startsWith('image/')) { setMessage('Выбери изображение кота.'); return; }
    if(f.size>12*1024*1024){ setMessage('Фото слишком большое. Выбери файл до 12 МБ.'); return; }
    const reader=new FileReader();
    reader.onload=()=>{ const data=String(reader.result||''); setPhoto(data); setFileName(f.name); setTab('camera'); setMessage(''); };
    reader.onerror=()=>setMessage('Не получилось открыть фото. Попробуй другое.');
    reader.readAsDataURL(f);
    e.target.value='';
  }
  function prepareCard(){
    if(!photo) return;
    const rarityIndex=pickRarity();
    const values=traits.map(t=>({label:t.label,value:rand(t.min,t.max)}));
    setDraft({id:crypto.randomUUID?.()||String(Date.now()),name:names[rand(0,names.length-1)],rarity:rarities[rarityIndex],rarityIndex,traits:values,createdAt:Date.now(),photo,xp:rarities[rarityIndex].bonus,originalName:fileName});
  }
  function saveCard(){
    if(!draft) return;
    if(cards.some(c=>c.id===draft.id)) return;
    setCards(prev=>[draft,...prev]); setXp(v=>v+draft.xp);
    setMissions(prev=>({...prev,photo:(prev.photo||0)+1}));
    setPhoto(''); setDraft(null); setTab('collection');
    setMessage(`Карточка добавлена! +${draft.xp} XP`);
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function removeCard(id){ if(!confirm('Удалить карточку из коллекции?')) return; const card=cards.find(c=>c.id===id); setCards(prev=>prev.filter(c=>c.id!==id)); if(card) setXp(v=>Math.max(0,v-card.xp)); }
  function exportData(){
    const blob=new Blob([JSON.stringify({cards,xp,missions,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='catgo-backup.json'; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><Cat size={25} strokeWidth={2.4}/></div>
      <div className="brand-copy"><strong>Cat Go</strong><span>кошачья экспедиция</span></div>
      <button className="icon-button" aria-label="О проекте" onClick={()=>setShowInfo(true)}><CircleHelp size={21}/></button>
    </header>

    {message && <button className="toast" onClick={()=>setMessage('')}>{message}<X size={16}/></button>}

    {tab==='home' && <main className="page">
      <section className="hero-card">
        <div className="hero-copy"><span className="eyebrow"><Sparkles size={13}/> ТВОЯ КОЛЛЕКЦИЯ НАЧИНАЕТСЯ ЗДЕСЬ</span><h1>Лови моменты.<br/><em>Собирай котиков!</em></h1><p>Встретил кота? Сделай фото и добавь его в свою коллекцию.</p><button className="primary-button" onClick={startPhoto}><Camera size={19}/> Найти кота</button></div>
        <div className="hero-cat"><div className="sun"></div><div className="cat-emoji">🐈</div><span className="sparkle s1">✦</span><span className="sparkle s2">✧</span><span className="hero-caption">реальные встречи ✨</span></div>
      </section>
      <section className="stats-grid">
        <div className="stat-card"><span className="stat-icon pink"><Zap size={18}/></span><span className="stat-label">ОПЫТ</span><strong>{xp} XP</strong><small>До уровня {level+1}: {100-nextXP} XP</small><div className="progress"><i style={{width:`${nextXP}%`}}/></div></div>
        <div className="stat-card"><span className="stat-icon yellow"><PawPrint size={18}/></span><span className="stat-label">КОЛЛЕКЦИЯ</span><strong>{cards.length} кот{cards.length===1?'ик':cards.length>=2&&cards.length<=4?'ика':'иков'}</strong><small>Каждая встреча — история</small></div>
      </section>
      <section className="section-head"><div><span className="eyebrow">ТВОЙ ПУТЬ</span><h2>Что будем делать?</h2></div></section>
      <div className="action-list">
        <button className="action-card" onClick={startPhoto}><span className="action-icon peach"><Camera size={22}/></span><span><strong>Сфотографировать кота</strong><small>Добавь настоящую встречу</small></span><ChevronRight size={20}/></button>
        <button className="action-card" onClick={()=>setTab('collection')}><span className="action-icon lilac"><Cat size={22}/></span><span><strong>Моя коллекция</strong><small>{cards.length?`${cards.length} карточек уже собрано`:'Тут будут твои котики'}</small></span><ChevronRight size={20}/></button>
        <button className="action-card" onClick={()=>setTab('missions')}><span className="action-icon mint"><Trophy size={22}/></span><span><strong>Задания</strong><small>Выполняй маленькие цели</small></span><ChevronRight size={20}/></button>
      </div>
      <p className="gentle-note"><Heart size={15}/> Фотографируй котиков бережно: не тревожь их и не подходи слишком близко.</p>
    </main>}

    {tab==='camera' && <main className="page">
      <button className="back-link" onClick={()=>{setTab('home');setPhoto('');setDraft(null)}}>← На главную</button>
      <div className="section-head"><div><span className="eyebrow">НОВАЯ НАХОДКА</span><h1>Кто тебе встретился?</h1><p className="muted">Сделай фото или выбери его из галереи.</p></div></div>
      {!photo && <div className="camera-empty"><div className="camera-art"><Camera size={44}/><span>🐾</span></div><h2>Готов к встрече?</h2><p>Камера откроется на твоём телефоне. Если она не появится, можно выбрать фото из галереи.</p><button className="primary-button full" onClick={startPhoto}><Camera size={19}/> Открыть камеру / галерею</button></div>}
      {photo && <div className="photo-flow">
        <div className="photo-preview"><img src={photo} alt="Твоё фото кота"/><span className="photo-tag"><Check size={14}/> Фото выбрано</span></div>
        {!draft ? <><div className="tip-card"><Sparkles size={18}/><span><strong>Отлично поймал момент!</strong><small>Нажми дальше, чтобы создать игровую карточку.</small></span></div><div className="button-row"><button className="secondary-button" onClick={startPhoto}><RotateCcw size={17}/> Переснять</button><button className="primary-button" onClick={prepareCard}>Создать карточку <ChevronRight size={18}/></button></div></> :
          <div className="draft-card"><div className="draft-head"><span className="rarity-pill" style={{'--rarity':draft.rarity.color}}>{draft.rarity.name}</span><span className="xp-pill"><Zap size={14}/> +{draft.xp} XP</span></div><h2>{draft.name}</h2><p className="muted">Характеристики для игры · генерируются случайно</p><div className="traits-grid">{draft.traits.map(t=><div className="trait" key={t.label}><div className="trait-head"><span>{t.label}</span><b>{t.value}</b></div><div className="trait-bar"><i style={{width:`${t.value}%`}}/></div></div>)}</div><div className="button-row"><button className="secondary-button" onClick={()=>setDraft(null)}>Назад</button><button className="primary-button" onClick={saveCard}><Check size={18}/> Добавить в коллекцию</button></div></div>}
      </div>}
      <input ref={inputRef} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={onFile}/>
      <p className="privacy-note"><Shield size={15}/> Фото сохраняются в этом браузере на этом устройстве. Пока они не загружаются на сервер.</p>
    </main>}

    {tab==='collection' && <main className="page">
      <section className="section-head collection-head"><div><span className="eyebrow">ТВОИ НАХОДКИ</span><h1>Моя коллекция</h1><p className="muted">Каждая карточка — кот, которого ты встретил.</p></div><button className="round-add" onClick={startPhoto}><Camera size={20}/></button></section>
      {cards.length===0 ? <div className="empty-state"><div className="empty-paw">🐾</div><h2>Пока здесь пусто</h2><p>Сделай первое фото настоящего кота, чтобы начать коллекцию.</p><button className="primary-button" onClick={startPhoto}><Camera size={18}/> Найти кота</button></div> :
      <><div className="collection-summary"><span><Cat size={17}/> {cards.length} карточек</span><span><Zap size={17}/> {xp} XP всего</span><button onClick={exportData}><Download size={16}/> Бэкап</button></div><div className="card-grid">{sortedCards.map(card=><article className="cat-card" key={card.id}><div className="cat-photo"><img src={card.photo} alt={card.name}/><span className="rarity-pill" style={{'--rarity':card.rarity.color}}>{card.rarity.name}</span><button className="delete-card" aria-label="Удалить карточку" onClick={()=>removeCard(card.id)}><Trash2 size={15}/></button></div><div className="cat-card-body"><h3>{card.name}</h3><div className="cat-card-meta"><span><Zap size={14}/> +{card.xp} XP</span><span>{new Date(card.createdAt).toLocaleDateString('ru-RU')}</span></div><div className="mini-traits">{card.traits.map(t=><span key={t.label}>{t.label}: <b>{t.value}</b></span>)}</div></div></article>)}</div></>}
      <p className="privacy-note"><Info size={15}/> Фото пока хранятся локально в браузере. Нажми «Бэкап», чтобы скачать JSON с карточками и данными; фотографии включены в него.</p>
    </main>}

    {tab==='missions' && <main className="page">
      <section className="section-head"><div><span className="eyebrow">МАЛЕНЬКИЕ ПРИКЛЮЧЕНИЯ</span><h1>Задания</h1><p className="muted">Собирай воспоминания, а не гоняйся за котиками.</p></div></section>
      <div className="mission-card"><div className="mission-icon peach"><Camera size={22}/></div><div className="mission-content"><strong>Первая встреча</strong><p>Добавь фото кота в свою коллекцию.</p><div className="mission-progress"><span>{Math.min(missions.photo||0,1)} / 1</span><div className="progress"><i style={{width:`${Math.min((missions.photo||0)*100,100)}%`}}/></div></div></div><span className="mission-reward"><Zap size={14}/> +20 XP</span></div>
      <div className="mission-card"><div className="mission-icon lilac"><PawPrint size={22}/></div><div className="mission-content"><strong>Коллекционер</strong><p>Собери 5 карточек котов.</p><div className="mission-progress"><span>{Math.min(cards.length,5)} / 5</span><div className="progress"><i style={{width:`${Math.min(cards.length/5*100,100)}%`}}/></div></div></div><span className="mission-reward"><Zap size={14}/> +50 XP</span></div>
      <div className="mission-card"><div className="mission-icon mint"><Compass size={22}/></div><div className="mission-content"><strong>Наблюдатель</strong><p>Сделай три фотографии котов.</p><div className="mission-progress"><span>{Math.min(missions.photo||0,3)} / 3</span><div className="progress"><i style={{width:`${Math.min((missions.photo||0)/3*100,100)}%`}}/></div></div></div><span className="mission-reward"><Zap size={14}/> +30 XP</span></div>
      <div className="note-card"><Heart size={18}/><p>Держи дистанцию, не используй вспышку и не фотографируй кота, если он выглядит напуганным.</p></div>
    </main>}

    {tab==='profile' && <main className="page">
      <section className="profile-hero"><div className="profile-avatar">🐈</div><span className="eyebrow">ТВОЙ ПРОФИЛЬ</span><h1>Котоисследователь</h1><p>Уровень {level} · {xp} XP</p><div className="profile-progress"><div className="progress"><i style={{width:`${nextXP}%`}}/></div><small>{nextXP}/100 XP до следующего уровня</small></div></section>
      <div className="profile-stat-row"><div><strong>{cards.length}</strong><span>Котов собрано</span></div><div><strong>{cards.filter(c=>c.rarityIndex>=3).length}</strong><span>Особых находок</span></div><div><strong>{level}</strong><span>Уровень</span></div></div>
      <button className="action-card" onClick={exportData}><span className="action-icon mint"><Download size={21}/></span><span><strong>Скачать резервную копию</strong><small>Экспорт данных коллекции</small></span><ChevronRight size={20}/></button>
      <button className="action-card" onClick={()=>{if(confirm('Удалить всю коллекцию и прогресс с этого устройства? Это действие нельзя отменить.')){setCards([]);setXp(0);setMissions({photo:0,days:0});setMessage('Данные очищены.')}}}><span className="action-icon peach"><Trash2 size={21}/></span><span><strong>Сбросить прогресс</strong><small>Удалить карточки и XP</small></span><ChevronRight size={20}/></button>
    </main>}

    <nav className="bottom-nav">
      {[['home',Compass,'Главная'],['collection',Cat,'Коллекция'],['missions',Trophy,'Задания'],['profile',UserRound,'Профиль']].map(([id,Icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={21} strokeWidth={tab===id?2.5:1.9}/><span>{label}</span>{id==='collection'&&cards.length>0&&<i className="nav-dot"/>}</button>)}
    </nav>
    {showInfo && <div className="modal-backdrop" onClick={()=>setShowInfo(false)}><div className="info-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowInfo(false)}><X size={19}/></button><div className="modal-icon">🐾</div><h2>Добро пожаловать в Cat Go!</h2><p>Фотографируй настоящих котов, создавай карточки и собирай коллекцию.</p><p><b>Важно:</b> редкость и характеристики сейчас генерируются игровыми правилами, а не распознаются по фото. Автоматическое вырезание фона пока не подключено.</p><button className="primary-button full" onClick={()=>setShowInfo(false)}>Понятно!</button></div></div>}
  </div>
}
createRoot(document.getElementById('root')).render(<App/>);
