import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Camera, Cat, Check, ChevronRight, CircleHelp, Compass, ImagePlus,
  PawPrint, RotateCcw, Sparkles, Trophy, UserRound, X, Zap, Heart,
  Shield, Trash2, Download, Info, Users, UserPlus, Search,
  Save, Palette, Pencil, UserCheck, UserX, Store, Lock, CheckCircle2
} from 'lucide-react';
import './style.css';

const TG = window.Telegram?.WebApp;
TG?.ready();
TG?.expand();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function catgoRequest(action, extra = {}) {
  if (!TG?.initData) throw new Error('Открой игру через Telegram-бота');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Не настроено подключение к Supabase');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/catgo-player`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ initData: TG.initData, action, ...extra }),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Сервер вернул некорректный ответ');
  }

  if (!response.ok) throw new Error(result.error || 'Ошибка сервера');
  return result;
}

const STORE_KEY = 'catgo_v1_cards';
const XP_KEY = 'catgo_v1_xp';
const MISSION_KEY = 'catgo_v1_missions';
const PROFILE_KEY = 'catgo_v1_profile';

const names = [
  'Пушистый исследователь', 'Рыжий охотник', 'Сонный философ',
  'Усатый путешественник', 'Хозяин дивана', 'Тихий наблюдатель',
  'Солнечный комочек', 'Ночной прыгун',
];

const backgrounds = {
  lavender: 'linear-gradient(135deg,#f1e8ff,#e6eaff)',
  sunset: 'linear-gradient(135deg,#ffe1d6,#ffd6e7)',
  mint: 'linear-gradient(135deg,#d8f7e7,#d9f2f2)',
  sky: 'linear-gradient(135deg,#d9edff,#e5e4ff)',
  night: 'linear-gradient(135deg,#35365f,#7065a7)',
  peach: 'linear-gradient(135deg,#fff0d7,#ffd7bd)',
};

const backgroundLabels = {
  lavender: 'Лаванда',
  sunset: 'Закат',
  mint: 'Мята',
  sky: 'Небо',
  night: 'Ночь',
  peach: 'Персик',
};

const backgroundUnlockLevels = {
  lavender: 1, sunset: 2, mint: 3, sky: 4, peach: 6, night: 8,
};

const avatarFrames = [
  { key: 'none', label: 'Без рамки', emoji: '⭕', level: 1, style: 'frame-none' },
  { key: 'gold', label: 'Золотая', emoji: '👑', level: 3, style: 'frame-gold' },
  { key: 'rose', label: 'Розовая', emoji: '🌸', level: 5, style: 'frame-rose' },
  { key: 'neon', label: 'Неоновая', emoji: '⚡', level: 7, style: 'frame-neon' },
  { key: 'cosmic', label: 'Космическая', emoji: '🌌', level: 10, style: 'frame-cosmic' },
];

const cardStyles = [
  { key: 'classic', label: 'Классика', level: 1, style: 'card-style-classic', emoji: '🐈' },
  { key: 'rose', label: 'Розовый блеск', level: 2, style: 'card-style-rose', emoji: '🌸' },
  { key: 'mint', label: 'Мятный', level: 4, style: 'card-style-mint', emoji: '🍃' },
  { key: 'night', label: 'Ночная охота', level: 7, style: 'card-style-night', emoji: '🌙' },
  { key: 'gold', label: 'Золотая коллекция', level: 10, style: 'card-style-gold', emoji: '✨' },
];

const avatarAccessories = [
  { key: 'none', label: 'Без аксессуара', emoji: '', level: 1 },
  { key: 'bow', label: 'Бантик', emoji: '🎀', level: 2 },
  { key: 'glasses', label: 'Очки', emoji: '🕶️', level: 4 },
  { key: 'crown', label: 'Корона', emoji: '👑', level: 6 },
  { key: 'halo', label: 'Ореол', emoji: '😇', level: 8 },
  { key: 'party', label: 'Праздничная шапка', emoji: '🥳', level: 12 },
];

function playerStorageKey(key) {
  const telegramId = TG?.initDataUnsafe?.user?.id;
  return telegramId ? `${key}_tg_${telegramId}` : key;
}

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function compressImage(file, maxSide = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(
        1,
        maxSide / Math.max(img.naturalWidth, img.naturalHeight)
      );
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Не удалось обработать изображение'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Не удалось сжать изображение'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось открыть изображение'));
    };

    img.src = objectUrl;
  });
}

const emptyProfile = {
  telegram_id: null,
  username: '',
  display_name: 'Котоисследователь',
  avatar_url: null,
  background_key: 'lavender',
};

function App() {
  const [serverReady, setServerReady] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [tab, setTab] = useState('home');

  const [cards, setCards] = useState(() => readJSON(playerStorageKey(STORE_KEY), []));
  const [xp, setXp] = useState(() => Number(localStorage.getItem(playerStorageKey(XP_KEY)) || 0));
  const [missions, setMissions] = useState(() =>
    readJSON(playerStorageKey(MISSION_KEY), { photo: 0, days: 0 })
  );
  const [profile, setProfile] = useState(() =>
    readJSON(playerStorageKey(PROFILE_KEY), emptyProfile)
  );

  const [photo, setPhoto] = useState('');
  const [fileName, setFileName] = useState('');
  const [draft, setDraft] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [message, setMessage] = useState('');

  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileBackground, setProfileBackground] = useState('lavender');

  const [friendQuery, setFriendQuery] = useState('');
  const [playerResults, setPlayerResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showcaseIds, setShowcaseIds] = useState(() =>
    readJSON(playerStorageKey(PROFILE_KEY), emptyProfile).showcase_card_ids || []
  );
  const [viewingFriend, setViewingFriend] = useState(null);
  const [loadingFriendProfile, setLoadingFriendProfile] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [renamingCardId, setRenamingCardId] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const inputRef = useRef(null);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      if (!TG?.initData) {
        setProfileName(profile.display_name || '');
        setProfileAvatar(profile.avatar_url || '');
        setProfileBackground(profile.background_key || 'lavender');
        setServerReady(true);
        return;
      }

      try {
        // Load only essential game data before showing the app.
        // Friends and requests are fetched after the first screen is ready.
        const [cardsResult, profileResult] = await Promise.allSettled([
          catgoRequest('get_cards'),
          catgoRequest('profile'),
        ]);

        if (cancelled) return;
        if (cardsResult.status === 'rejected') throw cardsResult.reason;

        const loadedCards = (cardsResult.value.cards || [])
          .map((row) => row.card_data || row)
          .filter((card) => card && card.id);

        setCards(loadedCards);
        setXp(loadedCards.reduce((sum, card) => sum + Number(card.xp || 0), 0));
        setMissions({ photo: loadedCards.length, days: 0 });

        if (profileResult.status === 'fulfilled') {
          const p = profileResult.value.profile || emptyProfile;
          setProfile({ ...emptyProfile, ...p });
          setShowcaseIds(
            Array.isArray(p.showcase_card_ids) ? p.showcase_card_ids : []
          );
          setProfileName(p.display_name || '');
          setProfileAvatar(p.avatar_url || '');
          setProfileBackground(p.background_key || 'lavender');
        } else {
          setMessage(
            `Не удалось загрузить профиль: ${profileResult.reason?.message || 'ошибка'}`
          );
        }

        setServerReady(true);

        Promise.allSettled([
          catgoRequest('friends_list'),
          catgoRequest('friend_requests'),
        ]).then(([friendsResult, requestsResult]) => {
          if (cancelled) return;
          if (friendsResult.status === 'fulfilled') {
            setFriends(friendsResult.value.friends || []);
          }
          if (requestsResult.status === 'fulfilled') {
            setFriendRequests(requestsResult.value.requests || []);
          }
        });
      } catch (error) {
        if (!cancelled) {
          setMessage(`Не удалось загрузить коллекцию: ${error.message}`);
          setServerReady(true);
        }
      }
    }

    loadPlayer();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (TG?.initData && !serverReady) return;
    localStorage.setItem(playerStorageKey(STORE_KEY), JSON.stringify(cards));
  }, [cards, serverReady]);

  useEffect(() => {
    if (TG?.initData && !serverReady) return;
    localStorage.setItem(playerStorageKey(XP_KEY), String(xp));
  }, [xp, serverReady]);

  useEffect(() => {
    if (TG?.initData && !serverReady) return;
    localStorage.setItem(playerStorageKey(MISSION_KEY), JSON.stringify(missions));
  }, [missions, serverReady]);

  useEffect(() => {
    if (TG?.initData && !serverReady) return;
    localStorage.setItem(
      playerStorageKey(PROFILE_KEY),
      JSON.stringify({ ...profile, showcase_card_ids: showcaseIds })
    );
  }, [profile, showcaseIds, serverReady]);

  const level = Math.floor(xp / 100) + 1;
  const nextXP = xp % 100;
  const sortedCards = useMemo(
    () => [...cards].sort(
      (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
    ),
    [cards]
  );

  function notify(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3200);
  }

  function startPhoto() {
    setPhoto('');
    setFileName('');
    setDraft(null);
    setTab('camera');
    setMessage('');
  }

  function openCamera() {
    if (!inputRef.current) return;
    inputRef.current.setAttribute('capture', 'environment');
    inputRef.current.click();
  }

  function openGallery() {
    if (!inputRef.current) return;
    inputRef.current.removeAttribute('capture');
    inputRef.current.click();
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('Выбери изображение.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage('Фото слишком большое. Выбери файл до 12 МБ.');
      return;
    }

    setMessage('Подготавливаю фотографию…');
    try {
      const compressed = await compressImage(file, 1280, 0.78);
      setPhoto(compressed);
      setFileName(file.name);
      setDraft(null);
      setTab('camera');
      setMessage('Фото готово. Теперь создай карточку.');
    } catch (error) {
      setMessage(error.message || 'Не удалось открыть фото.');
    }
  }

  function prepareCard() {
    if (!photo) return;

    setDraft({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      name: '',
      createdAt: Date.now(),
      photo,
      xp: 10,
      originalName: fileName,
    });
  }

  async function saveCard() {
    if (!draft || !serverReady || savingCard) return;

    const finalName = String(draft.name || '').trim();
    if (!finalName) {
      setMessage('Напиши имя кота перед сохранением.');
      return;
    }
    if (finalName.length > 40) {
      setMessage('Имя кота должно быть не длиннее 40 символов.');
      return;
    }
    if (cards.some((card) => card.id === draft.id)) {
      setMessage('Эта карточка уже добавлена.');
      return;
    }

    const cardToSave = { ...draft, name: finalName };
    setSavingCard(true);
    setMessage('');

    try {
      if (TG?.initData) {
        await catgoRequest('save_card', { card: cardToSave });
      }
      setCards((previous) => [cardToSave, ...previous]);
      setXp((previous) => previous + cardToSave.xp);
      setMissions((previous) => ({
        ...previous,
        photo: (previous.photo || 0) + 1,
      }));
      setPhoto('');
      setDraft(null);
      setTab('collection');
      setMessage(`Кот «${finalName}» добавлен! +${cardToSave.xp} XP`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessage(`Не удалось сохранить карточку: ${error.message}`);
    } finally {
      setSavingCard(false);
    }
  }

  async function saveCardName(card) {
    const name = renameValue.trim();

    if (!name) {
      setMessage('Имя не может быть пустым.');
      return;
    }
    if (name.length > 40) {
      setMessage('Имя кота должно быть не длиннее 40 символов.');
      return;
    }

    try {
      if (TG?.initData) {
        await catgoRequest('rename_card', { cardId: card.id, name });
      }
      setCards((previous) =>
        previous.map((item) => item.id === card.id ? { ...item, name } : item)
      );
      setRenamingCardId('');
      setRenameValue('');
      setMessage('Имя кота обновлено.');
    } catch (error) {
      setMessage(`Не удалось переименовать кота: ${error.message}`);
    }
  }

  async function removeCard(id) {
    if (!confirm('Удалить карточку из коллекции?')) return;

    try {
      if (TG?.initData) {
        await catgoRequest('delete_card', { cardId: id });
      }
      const card = cards.find((item) => item.id === id);
      setCards((previous) => previous.filter((item) => item.id !== id));
      setShowcaseIds((previous) => previous.filter((item) => item !== id));
      if (card) setXp((previous) => Math.max(0, previous - Number(card.xp || 0)));
      setMessage('Карточка удалена.');
    } catch (error) {
      setMessage(`Не удалось удалить карточку: ${error.message}`);
    }
  }

  async function onAvatarFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('Выбери изображение для аватарки.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage('Файл аватарки должен быть меньше 12 МБ.');
      return;
    }

    try {
      const compressed = await compressImage(file, 256, 0.72);
      setProfileAvatar(compressed);
      setMessage('Аватар выбран. Нажми «Сохранить профиль».');
    } catch (error) {
      setMessage(error.message || 'Не удалось обработать аватар.');
    }
  }

  async function saveProfile() {
    const displayName = profileName.trim();

    if (!displayName) {
      setMessage('Укажи имя профиля.');
      return;
    }
    if (displayName.length > 32) {
      setMessage('Имя профиля должно быть не длиннее 32 символов.');
      return;
    }

    setSavingProfile(true);
    try {
      const updated = {
        ...profile,
        display_name: displayName,
        avatar_url: profileAvatar || null,
        background_key: profileBackground,
        showcase_card_ids: showcaseIds,
        avatar_frame_key: profile.avatar_frame_key || 'none',
        avatar_accessory_key: profile.avatar_accessory_key || 'none',
        cat_card_style_key: profile.cat_card_style_key || 'classic',
      };

      if (TG?.initData) {
        const result = await catgoRequest('update_profile', {
          display_name: displayName,
          avatar_url: profileAvatar || null,
          background_key: profileBackground,
          showcase_card_ids: showcaseIds,
          avatar_frame_key: profile.avatar_frame_key || 'none',
          avatar_accessory_key: profile.avatar_accessory_key || 'none',
          cat_card_style_key: profile.cat_card_style_key || 'classic',
        });
        setProfile({ ...updated, ...(result.profile || {}) });
      } else {
        setProfile(updated);
      }

      setMessage('Профиль сохранён!');
    } catch (error) {
      setMessage(`Не удалось сохранить профиль: ${error.message}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function refreshSocial() {
    if (!TG?.initData) return;
    const [friendsResult, requestsResult] = await Promise.all([
      catgoRequest('friends_list'),
      catgoRequest('friend_requests'),
    ]);
    setFriends(friendsResult.friends || []);
    setFriendRequests(requestsResult.requests || []);
  }

  async function searchPlayers(event) {
    event?.preventDefault();

    const query = friendQuery.trim().replace(/^@/, '');
    if (query.length < 2) {
      setMessage('Введи Telegram username (минимум 2 символа).');
      return;
    }
    if (!TG?.initData) {
      setMessage('Поиск настоящих друзей доступен внутри Telegram.');
      return;
    }

    setSearchingFriends(true);
    try {
      const result = await catgoRequest('search_players', { query });
      setPlayerResults(result.players || []);

      if (!(result.players || []).length) {
        setMessage('Игрок не найден. Он должен хотя бы раз открыть Cat Go.');
      } else {
        setMessage(`Найдено игроков: ${result.players.length}`);
      }
    } catch (error) {
      setMessage(`Не удалось найти игрока: ${error.message}`);
    } finally {
      setSearchingFriends(false);
    }
  }

  async function sendFriendRequest(player) {
    try {
      const result = await catgoRequest('send_friend_request', {
        telegramId: Number(player.telegram_id),
      });
      await refreshSocial();
      setPlayerResults((previous) =>
        previous.filter((item) => item.telegram_id !== player.telegram_id)
      );
      setMessage(
        result.status === 'accepted' ? 'Вы уже друзья!' : 'Запрос в друзья отправлен.'
      );
    } catch (error) {
      setMessage(`Не удалось отправить запрос: ${error.message}`);
    }
  }

  async function respondFriendRequest(request, decision) {
    try {
      await catgoRequest('respond_friend_request', {
        requestId: request.id,
        decision,
      });
      await refreshSocial();
      setMessage(
        decision === 'accepted' ? 'Запрос принят. Вы теперь друзья!' : 'Запрос отклонён.'
      );
    } catch (error) {
      setMessage(`Не удалось обработать запрос: ${error.message}`);
    }
  }

  async function removeFriend(friend) {
    if (!confirm(`Удалить ${friend.display_name || friend.username || 'этого игрока'} из друзей?`)) {
      return;
    }

    try {
      await catgoRequest('remove_friend', {
        telegramId: Number(friend.telegram_id),
      });
      await refreshSocial();
      setMessage('Игрок удалён из друзей.');
    } catch (error) {
      setMessage(`Не удалось удалить друга: ${error.message}`);
    }
  }

  function toggleShowcaseCard(cardId) {
    setShowcaseIds((previous) => {
      if (previous.includes(cardId)) {
        return previous.filter((id) => id !== cardId);
      }
      if (previous.length >= 6) {
        setMessage('В витрине может быть не больше 6 котов.');
        return previous;
      }
      return [...previous, cardId];
    });
  }

  async function openFriendProfile(friend) {
    if (!TG?.initData) {
      setMessage('Профили друзей доступны при запуске игры через Telegram.');
      return;
    }

    setLoadingFriendProfile(true);
    setViewingFriend({ profile: friend, cards: [], showcase_card_ids: [] });

    try {
      const result = await catgoRequest('public_profile', {
        telegramId: Number(friend.telegram_id),
      });
      const publicProfile = result.profile || friend;
      const publicCards = (result.cards || [])
        .map((row) => row.card_data || row)
        .filter((card) => card && card.id);

      setViewingFriend({
        profile: publicProfile,
        cards: publicCards,
        showcase_card_ids: Array.isArray(result.showcase_card_ids)
          ? result.showcase_card_ids
          : (publicProfile.showcase_card_ids || []),
      });
    } catch (error) {
      setViewingFriend(null);
      setMessage(
        `Не удалось открыть профиль друга: ${error.message}. Нужна поддержка действия public_profile на сервере.`
      );
    } finally {
      setLoadingFriendProfile(false);
    }
  }

  function exportData() {
    const blob = new Blob(
      [JSON.stringify(
        { cards, xp, missions, profile, exportedAt: new Date().toISOString() },
        null,
        2
      )],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catgo-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const profileBackgroundStyle =
    backgrounds[profileBackground] || backgrounds.lavender;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Cat size={25} strokeWidth={2.4} /></div>
        <div className="brand-copy">
          <strong>Cat Go</strong><span>кошачья экспедиция</span>
        </div>
        <button className="icon-button" aria-label="О проекте" onClick={() => setShowInfo(true)}>
          <CircleHelp size={21} />
        </button>
      </header>

      {!serverReady && <div className="sync-banner"><span className="sync-dot" /> Синхронизируем профиль и коллекцию…</div>}

      {message && (
        <button className="toast" onClick={() => setMessage('')}>
          {message}<X size={16} />
        </button>
      )}

      {tab === 'home' && (
        <main className="page">
          <section className="hero-card">
            <div className="hero-copy">
              <span className="eyebrow">
                <Sparkles size={13} /> ТВОЯ КОЛЛЕКЦИЯ НАЧИНАЕТСЯ ЗДЕСЬ
              </span>
              <h1>Мир полон котиков.<br /><em>Найди своих!</em></h1>
              <p>Встретил кота? Сделай фото, придумай имя и добавь его в коллекцию.</p>
              <button className="primary-button" onClick={startPhoto}>
                <Camera size={19} /> Найти кота
              </button>
            </div>
            <div className="hero-cat">
              <div className="sun" /><div className="cat-emoji">🐈</div>
              <span className="sparkle s1">✦</span>
              <span className="sparkle s2">✧</span>
              <span className="hero-caption">реальные встречи ✨</span>
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon pink"><Zap size={18} /></span>
              <span className="stat-label">ОПЫТ</span>
              <strong>{xp} XP</strong>
              <small>До уровня {level + 1}: {100 - nextXP} XP</small>
              <div className="progress"><i style={{ width: `${nextXP}%` }} /></div>
            </div>
            <div className="stat-card">
              <span className="stat-icon yellow"><PawPrint size={18} /></span>
              <span className="stat-label">КОЛЛЕКЦИЯ</span>
              <strong>
                {cards.length} {cards.length === 1
                  ? 'котик'
                  : cards.length >= 2 && cards.length <= 4
                    ? 'котика' : 'котиков'}
              </strong>
              <small>Каждая встреча — история</small>
            </div>
          </section>

          <section className="section-head">
            <div><span className="eyebrow">ТВОЙ ПУТЬ</span><h2>Что будем делать?</h2></div>
          </section>

          <div className="action-list">
            <button className="action-card" onClick={startPhoto}>
              <span className="action-icon peach"><Camera size={22} /></span>
              <span><strong>Сфотографировать кота</strong><small>Придумай ему собственное имя</small></span>
              <ChevronRight size={20} />
            </button>
            <button className="action-card" onClick={() => setTab('collection')}>
              <span className="action-icon lilac"><Cat size={22} /></span>
              <span><strong>Моя коллекция</strong><small>{cards.length ? `${cards.length} карточек уже собрано` : 'Тут будут твои котики'}</small></span>
              <ChevronRight size={20} />
            </button>
            <button className="action-card" onClick={() => setTab('friends')}>
              <span className="action-icon mint"><Users size={22} /></span>
              <span><strong>Друзья</strong><small>{friends.length} друзей · {friendRequests.length} запросов</small></span>
              <ChevronRight size={20} />
            </button>
          </div>
          <p className="gentle-note">
            <Heart size={15} /> Фотографируй котиков бережно: не тревожь их и не подходи слишком близко.
          </p>
        </main>
      )}

      {tab === 'camera' && (
        <main className="page">
          <button className="back-link" onClick={() => {
            setTab('home'); setPhoto(''); setDraft(null);
          }}>← На главную</button>

          <div className="section-head">
            <div>
              <span className="eyebrow">НОВАЯ НАХОДКА</span>
              <h1>Кто тебе встретился?</h1>
              <p className="muted">Сделай фото или выбери его из галереи.</p>
            </div>
          </div>

          {!photo && (
            <div className="camera-empty">
              <div className="camera-art"><Camera size={44} /><span>🐾</span></div>
              <h2>Готов к встрече?</h2>
              <p>Сфотографируй кота или выбери готовое фото из галереи.</p>
              <div className="photo-actions">
                <button className="primary-button full" onClick={openCamera}>
                  <Camera size={19} /> Сфотографировать
                </button>
                <button className="secondary-button full" onClick={openGallery}>
                  <ImagePlus size={19} /> Выбрать из галереи
                </button>
              </div>
            </div>
          )}

          {photo && (
            <div className="photo-flow">
              <div className="photo-preview">
                <img src={photo} alt="Выбранная фотография" />
                <span className="photo-tag"><Check size={14} /> Фото выбрано</span>
              </div>

              {!draft ? (
                <>
                  <div className="tip-card">
                    <Sparkles size={18} />
                    <span><strong>Отличный момент!</strong><small>Фото сжато для экономии места. Теперь придумай коту имя.</small></span>
                  </div>
                  <div className="button-row">
                    <button className="secondary-button" onClick={openCamera}>
                      <RotateCcw size={17} /> Переснять
                    </button>
                    <button className="primary-button" onClick={prepareCard}>
                      Создать карточку <ChevronRight size={18} />
                    </button>
                  </div>
                  <button className="secondary-button full" onClick={openGallery}>
                    <ImagePlus size={17} /> Выбрать другое фото
                  </button>
                </>
              ) : (
                <div className="draft-card">
                  <div className="draft-head">
                    <span className="xp-pill"><Zap size={14} /> +{draft.xp} XP</span>
                  </div>
                  <label className="field-label">Как зовут этого кота?</label>
                  <input
                    className="field-input"
                    maxLength={40}
                    placeholder="Например, Барсик"
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <p className="muted">Имя можно будет изменить позже. За каждого кота начисляется 10 XP.</p>
                  <div className="button-row">
                    <button className="secondary-button" onClick={() => setDraft(null)} disabled={savingCard}>
                      Назад
                    </button>
                    <button className="primary-button" onClick={saveCard} disabled={savingCard || !serverReady}>
                      <Check size={18} /> {savingCard ? 'Сохраняю…' : 'Добавить в коллекцию'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
          />
          <p className="privacy-note">
            <Shield size={15} /> Фото сжимаются перед сохранением карточки. Распознавание котов пока не подключено.
          </p>
        </main>
      )}

      {tab === 'collection' && (
        <main className="page">
          <section className="section-head collection-head">
            <div>
              <span className="eyebrow">ТВОИ НАХОДКИ</span>
              <h1>Моя коллекция</h1>
              <p className="muted">Каждая карточка — кот, которого ты встретил.</p>
            </div>
            <button className="round-add" onClick={startPhoto}><Camera size={20} /></button>
          </section>

          {cards.length === 0 ? (
            <div className="empty-state">
              <div className="empty-paw">🐾</div>
              <h2>Пока здесь пусто</h2>
              <p>Сделай первое фото настоящего кота.</p>
              <button className="primary-button" onClick={startPhoto}><Camera size={18} /> Найти кота</button>
            </div>
          ) : (
            <>
              <div className="collection-summary">
                <span><Cat size={17} /> {cards.length} карточек</span>
                <span><Zap size={17} /> {xp} XP всего</span>
                <button onClick={exportData}><Download size={16} /> Бэкап</button>
              </div>
              <div className="card-grid">
                {sortedCards.map((card) => (
                  <article className={`cat-card ${(cardStyles.find((item) => item.key === profile.cat_card_style_key) || cardStyles[0]).style}`} key={card.id}>
                    <div className="cat-photo">
                      <img src={card.photo} alt={card.name || 'Кот'} />
                      <button className="delete-card" aria-label="Удалить карточку" onClick={() => removeCard(card.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="cat-card-body">
                      {renamingCardId === card.id ? (
                        <div className="rename-row">
                          <input className="field-input" maxLength={40} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                          <button className="small-action" onClick={() => saveCardName(card)} aria-label="Сохранить имя"><Check size={17} /></button>
                          <button className="small-action" onClick={() => setRenamingCardId('')} aria-label="Отмена"><X size={17} /></button>
                        </div>
                      ) : (
                        <div className="card-name-row">
                          <h3>{card.name || 'Без имени'}</h3>
                          <button className="small-action" aria-label="Переименовать кота" onClick={() => {
                            setRenamingCardId(card.id); setRenameValue(card.name || '');
                          }}><Pencil size={15} /></button>
                        </div>
                      )}
                      <div className="cat-card-meta">
                        <span><Zap size={14} /> +{card.xp} XP</span>
                        <span>{new Date(card.createdAt || Date.now()).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          <p className="privacy-note"><Info size={15} /> Бэкап содержит данные карточек и фотографии.</p>
        </main>
      )}

      {tab === 'missions' && (
        <main className="page">
          <section className="section-head">
            <div><span className="eyebrow">МАЛЕНЬКИЕ ПРИКЛЮЧЕНИЯ</span><h1>Задания</h1><p className="muted">Собирай воспоминания, а не гоняйся за котиками.</p></div>
          </section>
          <div className="mission-card">
            <div className="mission-icon peach"><Camera size={22} /></div>
            <div className="mission-content">
              <strong>Первая встреча</strong><p>Добавь фото кота в коллекцию.</p>
              <div className="mission-progress">
                <span>{Math.min(missions.photo || 0, 1)} / 1</span>
                <div className="progress"><i style={{ width: `${Math.min((missions.photo || 0) * 100, 100)}%` }} /></div>
              </div>
            </div>
            <span className="mission-reward"><Zap size={14} /> +20 XP</span>
          </div>
          <div className="mission-card">
            <div className="mission-icon lilac"><PawPrint size={22} /></div>
            <div className="mission-content">
              <strong>Коллекционер</strong><p>Собери 5 карточек котов.</p>
              <div className="mission-progress">
                <span>{Math.min(cards.length, 5)} / 5</span>
                <div className="progress"><i style={{ width: `${Math.min(cards.length / 5 * 100, 100)}%` }} /></div>
              </div>
            </div>
            <span className="mission-reward"><Zap size={14} /> +50 XP</span>
          </div>
          <div className="mission-card">
            <div className="mission-icon mint"><Compass size={22} /></div>
            <div className="mission-content">
              <strong>Наблюдатель</strong><p>Сделай три фотографии котов.</p>
              <div className="mission-progress">
                <span>{Math.min(missions.photo || 0, 3)} / 3</span>
                <div className="progress"><i style={{ width: `${Math.min((missions.photo || 0) / 3 * 100, 100)}%` }} /></div>
              </div>
            </div>
            <span className="mission-reward"><Zap size={14} /> +30 XP</span>
          </div>
          <div className="note-card"><Heart size={18} /><p>Держи дистанцию, не используй вспышку и не фотографируй кота, если он выглядит напуганным.</p></div>
        </main>
      )}

      {tab === 'profile' && (
        <main className="page">
          <section className="profile-edit-hero" style={{ background: profileBackgroundStyle }}>
            <div className={`profile-avatar-wrap ${(avatarFrames.find((item) => item.key === profile.avatar_frame_key) || avatarFrames[0]).style}`}>
              {profileAvatar
                ? <img className="profile-avatar-img" src={profileAvatar} alt="Аватар профиля" />
                : <div className="profile-avatar">🐈</div>}
              {(() => {
                const accessory = avatarAccessories.find((item) => item.key === profile.avatar_accessory_key);
                return accessory?.emoji ? <span className="avatar-accessory" aria-label={accessory.label}>{accessory.emoji}</span> : null;
              })()}
              <button className="avatar-edit-button" onClick={() => avatarInputRef.current?.click()} aria-label="Изменить аватар">
                <Camera size={16} />
              </button>
            </div>
            <input ref={avatarInputRef} className="hidden-input" type="file" accept="image/*" onChange={onAvatarFile} />
            <span className="eyebrow">ТВОЙ ПРОФИЛЬ</span>
            <h1>{profile.display_name || 'Котоисследователь'}</h1>
            <p>Уровень {level} · {xp} XP</p>
            {profile.username && <small className="profile-username">@{profile.username}</small>}
            <div className="profile-progress">
              <div className="progress"><i style={{ width: `${nextXP}%` }} /></div>
              <small>{nextXP}/100 XP до следующего уровня</small>
            </div>
          </section>

          <section className="profile-editor panel">
            <h2><Pencil size={19} /> Редактировать профиль</h2>
            <label className="field-label">Имя в Cat Go</label>
            <input className="field-input" maxLength={32} placeholder="Как тебя называть?" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            <label className="field-label">Аватар</label>
            <button className="secondary-button full" onClick={() => avatarInputRef.current?.click()}>
              <ImagePlus size={18} /> Выбрать из галереи
            </button>
            <label className="field-label"><Palette size={16} /> Фон профиля</label>
            <p className="muted">Новые фоны открываются за уровни в магазине.</p>
            <div className="background-picker">
              {Object.keys(backgrounds).filter((key) => level >= backgroundUnlockLevels[key]).map((key) => (
                <button
                  key={key}
                  className={`background-option ${profileBackground === key ? 'selected' : ''}`}
                  style={{ background: backgrounds[key] }}
                  onClick={() => setProfileBackground(key)}
                  aria-label={backgroundLabels[key]}
                  title={backgroundLabels[key]}
                >
                  {profileBackground === key && <Check size={17} />}
                  <span>{backgroundLabels[key]}</span>
                </button>
              ))}
            </div>
            <button className="secondary-button full" onClick={() => setTab('shop')}>
              <Store size={17} /> Открыть магазин фонов
            </button>
            <button className="primary-button full" onClick={saveProfile} disabled={savingProfile || !serverReady}>
              <Save size={18} /> {savingProfile ? 'Сохраняю…' : !serverReady ? 'Синхронизация…' : 'Сохранить профиль'}
            </button>
          </section>

          <div className="profile-stat-row">
            <div><strong>{cards.length}</strong><span>Котов собрано</span></div>
            <div><strong>{xp}</strong><span>Всего XP</span></div>
            <div><strong>{level}</strong><span>Уровень</span></div>
          </div>

          <section className="profile-editor panel">
            <h2><Sparkles size={19} /> Моя витрина</h2>
            <p className="muted">Выбери до 6 котов, которых увидят другие игроки в твоём профиле. Нажми «Сохранить профиль», чтобы сохранить выбор.</p>
            <div className="card-grid">
              {sortedCards.map((card) => {
                const selected = showcaseIds.includes(card.id);
                return (
                  <button
                    type="button"
                    key={card.id}
                    onClick={() => toggleShowcaseCard(card.id)}
                    className="cat-card"
                    style={{
                      padding: 0,
                      textAlign: 'left',
                      border: selected ? '2px solid #e3a52f' : undefined,
                      opacity: selected ? 1 : 0.88,
                    }}
                  >
                    <div className="cat-card-image-wrap">
                      <img src={card.photo} alt={card.name || 'Кот'} />
                      <span className="rarity-pill" style={{ '--rarity': card.rarity?.color || '#8a9a86' }}>
                        {card.rarity?.name || 'Обычный'}
                      </span>
                      {selected && (
                        <span className="rarity-pill" style={{ right: 8, left: 'auto', top: 38, background: '#2c765c' }}>
                          На витрине ✓
                        </span>
                      )}
                    </div>
                    <div className="cat-card-body"><h3>{card.name || 'Без имени'}</h3></div>
                  </button>
                );
              })}
            </div>
            {cards.length === 0 && <p className="muted">Сначала добавь котов в коллекцию.</p>}
            <p className="privacy-note">Выбрано: {showcaseIds.length} / 6</p>
          </section>

          <button className="action-card" onClick={exportData}>
            <span className="action-icon mint"><Download size={21} /></span>
            <span><strong>Скачать резервную копию</strong><small>Экспорт данных коллекции</small></span>
            <ChevronRight size={20} />
          </button>
          <p className="privacy-note"><Shield size={15} /> Аватар сохраняется в профиле после сжатия. Не загружай изображения, содержащие личные данные.</p>
        </main>
      )}

      {tab === 'shop' && (
        <main className="page">
          <section className="section-head">
            <div>
              <span className="eyebrow">НАГРАДЫ ЗА ПРОГРЕСС</span>
              <h1><Store size={25} /> Магазин</h1>
              <p className="muted">Повышай уровень, чтобы открывать новые оформления профиля. XP не тратится — разблокировки остаются навсегда.</p>
            </div>
          </section>

          <section className="shop-level-card">
            <div className="shop-level-icon"><Zap size={23} /></div>
            <div className="shop-level-copy">
              <strong>Уровень {level}</strong>
              <span>{xp} XP · следующий уровень через {100 - nextXP} XP</span>
              <div className="progress"><i style={{ width: `${nextXP}%` }} /></div>
            </div>
          </section>

          <section className="shop-category">
            <h2><Palette size={19} /> Фоны профиля</h2>
            <div className="shop-grid">
              {Object.keys(backgrounds).map((key) => {
                const requiredLevel = backgroundUnlockLevels[key];
                const unlocked = level >= requiredLevel;
                const equipped = profileBackground === key;
                return (
                  <article className={`shop-item ${unlocked ? '' : 'locked'}`} key={`bg-${key}`}>
                    <div className="shop-preview" style={{ background: backgrounds[key] }}>
                      <span className="shop-preview-cat">🐈</span>
                      {!unlocked && <span className="shop-lock"><Lock size={16} /> Ур. {requiredLevel}</span>}
                      {unlocked && equipped && <span className="shop-equipped"><CheckCircle2 size={15} /> Надето</span>}
                    </div>
                    <div className="shop-item-body">
                      <strong>{backgroundLabels[key]}</strong>
                      <small>{unlocked ? (equipped ? 'Уже используется' : 'Открыто') : `Откроется на уровне ${requiredLevel}`}</small>
                      <button className={equipped ? 'secondary-button full' : 'primary-button full'} disabled={!unlocked || equipped}
                        onClick={() => { setProfileBackground(key); setProfile((prev) => ({ ...prev, background_key: key })); setMessage(`Фон «${backgroundLabels[key]}» выбран. Не забудь сохранить профиль.`); }}>
                        {equipped ? 'Используется' : unlocked ? 'Выбрать' : <><Lock size={15} /> Закрыто</>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="shop-category">
            <h2><UserRound size={19} /> Рамки аватара</h2>
            <div className="shop-grid">
              {avatarFrames.map((item) => {
                const unlocked = level >= item.level;
                const equipped = (profile.avatar_frame_key || 'none') === item.key;
                return <article className={`shop-item ${unlocked ? '' : 'locked'}`} key={`frame-${item.key}`}>
                  <div className={`shop-preview cosmetic-preview ${item.style}`}>
                    <div className="cosmetic-avatar">🐈</div>
                    {!unlocked && <span className="shop-lock"><Lock size={15} /> Ур. {item.level}</span>}
                    {unlocked && equipped && <span className="shop-equipped"><CheckCircle2 size={15} /> Надето</span>}
                  </div>
                  <div className="shop-item-body"><strong>{item.label}</strong><small>{unlocked ? (equipped ? 'Уже используется' : 'Открыто') : `Откроется на уровне ${item.level}`}</small>
                    <button className={equipped ? 'secondary-button full' : 'primary-button full'} disabled={!unlocked || equipped} onClick={() => setProfile((prev) => ({ ...prev, avatar_frame_key: item.key }))}>{equipped ? 'Используется' : unlocked ? 'Надеть рамку' : <><Lock size={15} /> Закрыто</>}</button>
                  </div>
                </article>;
              })}
            </div>
          </section>

          <section className="shop-category">
            <h2><Cat size={19} /> Оформление карточек</h2>
            <div className="shop-grid">
              {cardStyles.map((item) => {
                const unlocked = level >= item.level;
                const equipped = (profile.cat_card_style_key || 'classic') === item.key;
                return <article className={`shop-item ${unlocked ? '' : 'locked'}`} key={`card-${item.key}`}>
                  <div className={`shop-preview ${item.style}`}><span className="shop-preview-cat">{item.emoji}</span>
                    {!unlocked && <span className="shop-lock"><Lock size={15} /> Ур. {item.level}</span>}
                    {unlocked && equipped && <span className="shop-equipped"><CheckCircle2 size={15} /> Надето</span>}
                  </div>
                  <div className="shop-item-body"><strong>{item.label}</strong><small>{unlocked ? (equipped ? 'Уже используется' : 'Открыто') : `Откроется на уровне ${item.level}`}</small>
                    <button className={equipped ? 'secondary-button full' : 'primary-button full'} disabled={!unlocked || equipped} onClick={() => setProfile((prev) => ({ ...prev, cat_card_style_key: item.key }))}>{equipped ? 'Используется' : unlocked ? 'Выбрать стиль' : <><Lock size={15} /> Закрыто</>}</button>
                  </div>
                </article>;
              })}
            </div>
          </section>

          <section className="shop-category">
            <h2><Sparkles size={19} /> Аксессуары аватара</h2>
            <div className="shop-grid">
              {avatarAccessories.map((item) => {
                const unlocked = level >= item.level;
                const equipped = (profile.avatar_accessory_key || 'none') === item.key;
                return <article className={`shop-item ${unlocked ? '' : 'locked'}`} key={`accessory-${item.key}`}>
                  <div className="shop-preview accessory-preview" style={{ background: backgrounds[profileBackground] || backgrounds.lavender }}>
                    <span className="shop-preview-cat">{item.emoji || '🐈'}</span>
                    {!unlocked && <span className="shop-lock"><Lock size={15} /> Ур. {item.level}</span>}
                    {unlocked && equipped && <span className="shop-equipped"><CheckCircle2 size={15} /> Надето</span>}
                  </div>
                  <div className="shop-item-body"><strong>{item.label}</strong><small>{unlocked ? (equipped ? 'Уже используется' : 'Открыто') : `Откроется на уровне ${item.level}`}</small>
                    <button className={equipped ? 'secondary-button full' : 'primary-button full'} disabled={!unlocked || equipped} onClick={() => setProfile((prev) => ({ ...prev, avatar_accessory_key: item.key }))}>{equipped ? 'Используется' : unlocked ? 'Надеть' : <><Lock size={15} /> Закрыто</>}</button>
                  </div>
                </article>;
              })}
            </div>
          </section>
          <div className="note-card"><Sparkles size={18} /><p>Награды открываются за уровень, XP не списывается. Выбери оформление, затем зайди в профиль и нажми «Сохранить профиль».</p></div>
        </main>
      )}

      {tab === 'friends' && (
        <main className="page">
          <section className="section-head">
            <div>
              <span className="eyebrow">ИГРАЙ ВМЕСТЕ</span>
              <h1>Друзья</h1>
              <p className="muted">Найди игроков Cat Go по Telegram username.</p>
            </div>
          </section>

          {!TG?.initData && (
            <div className="note-card"><Info size={18} /><p>Настоящие друзья работают при открытии игры через Telegram-бота.</p></div>
          )}

          <form className="friend-search-form" onSubmit={searchPlayers}>
            <Search size={19} />
            <input className="field-input" value={friendQuery} onChange={(e) => setFriendQuery(e.target.value)} placeholder="@username" autoComplete="off" />
            <button className="primary-button" type="submit" disabled={searchingFriends}>
              <Search size={17} /> {searchingFriends ? 'Ищу…' : 'Найти'}
            </button>
          </form>
          <p className="privacy-note">Показываются только игроки, которые хотя бы раз запускали Cat Go.</p>

          {playerResults.length > 0 && (
            <section className="friends-section">
              <h2>Результаты поиска</h2>
              {playerResults.map((player) => (
                <div className="friend-row" key={player.telegram_id}>
                  {player.avatar_url
                    ? <img className="friend-avatar" src={player.avatar_url} alt="" />
                    : <div className="friend-avatar fallback">🐈</div>}
                  <button
                    type="button"
                    className="friend-details"
                    style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, color: 'inherit' }}
                    onClick={() => openFriendProfile(player)}
                  >
                    <strong>{player.display_name || 'Котоисследователь'}</strong>
                    <span>@{player.username || 'username не указан'}</span>
                  </button>
                  <button className="small-action friend-add" onClick={() => sendFriendRequest(player)} aria-label="Добавить в друзья">
                    <UserPlus size={19} />
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="friends-section">
            <h2><UserCheck size={19} /> Запросы в друзья ({friendRequests.length})</h2>
            {friendRequests.length === 0
              ? <p className="muted">Новых запросов пока нет.</p>
              : friendRequests.map((request) => {
                const person = request.profile || request.requester || {};
                return (
                  <div className="friend-row" key={request.id}>
                    {person.avatar_url
                      ? <img className="friend-avatar" src={person.avatar_url} alt="" />
                      : <div className="friend-avatar fallback">🐈</div>}
                    <div className="friend-details">
                      <strong>{person.display_name || 'Котоисследователь'}</strong>
                      <span>@{person.username || 'username не указан'}</span>
                    </div>
                    <button className="small-action accept-action" onClick={() => respondFriendRequest(request, 'accepted')} aria-label="Принять запрос">
                      <Check size={18} />
                    </button>
                    <button className="small-action reject-action" onClick={() => respondFriendRequest(request, 'declined')} aria-label="Отклонить запрос">
                      <X size={18} />
                    </button>
                  </div>
                );
              })}
          </section>

          <section className="friends-section">
            <h2><Users size={19} /> Мои друзья ({friends.length})</h2>
            {friends.length === 0 ? (
              <div className="empty-state compact">
                <div className="empty-paw">🐾</div>
                <h2>Пока без друзей</h2>
                <p>Найди знакомого по его Telegram username.</p>
              </div>
            ) : friends.map((friend) => (
              <div className="friend-row" key={friend.telegram_id}>
                {friend.avatar_url
                  ? <img className="friend-avatar" src={friend.avatar_url} alt="" />
                  : <div className="friend-avatar fallback">🐈</div>}
                <button
                  type="button"
                  className="friend-details"
                  style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, color: 'inherit' }}
                  onClick={() => openFriendProfile(friend)}
                >
                  <strong>{friend.display_name || 'Котоисследователь'}</strong>
                  <span>@{friend.username || 'username не указан'}</span>
                </button>
                <button className="small-action" onClick={() => openFriendProfile(friend)} aria-label="Открыть профиль">
                  <UserRound size={18} />
                </button>
                <button className="small-action reject-action" onClick={() => removeFriend(friend)} aria-label="Удалить из друзей">
                  <UserX size={18} />
                </button>
              </div>
            ))}
          </section>
        </main>
      )}

      {viewingFriend && (
        <div className="modal-backdrop" onClick={() => setViewingFriend(null)}>
          <section
            className="info-modal"
            style={{ width: 'min(100%, 560px)', maxHeight: '82vh', overflowY: 'auto' }}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setViewingFriend(null)} aria-label="Закрыть профиль">
              <X size={19} />
            </button>
            <div
              className="profile-edit-hero"
              style={{
                background: backgrounds[viewingFriend.profile?.background_key] || backgrounds.lavender,
                borderRadius: 18,
                marginBottom: 16,
              }}
            >
              {viewingFriend.profile?.avatar_url
                ? <img className="profile-avatar-img" src={viewingFriend.profile.avatar_url} alt="Аватар" />
                : <div className="profile-avatar">🐈</div>}
              <h2>{viewingFriend.profile?.display_name || 'Котоисследователь'}</h2>
              {viewingFriend.profile?.username && <small>@{viewingFriend.profile.username}</small>}
              <p>{viewingFriend.cards.length} котов в коллекции</p>
            </div>

            {loadingFriendProfile ? (
              <p className="muted">Загружаем профиль и витрину…</p>
            ) : (
              <>
                <h2 style={{ textAlign: 'left' }}>Витрина котов</h2>
                {(() => {
                  const showcase = viewingFriend.showcase_card_ids || [];
                  const featured = showcase
                    .map((id) => viewingFriend.cards.find((card) => String(card.id) === String(id)))
                    .filter(Boolean);

                  return featured.length ? (
                    <div className="card-grid">
                      {featured.map((card) => (
                        <article className={`cat-card ${(cardStyles.find((item) => item.key === viewingFriend.profile?.cat_card_style_key) || cardStyles[0]).style}`} key={card.id}>
                          <div className="cat-card-image-wrap">
                            <img src={card.photo} alt={card.name || 'Кот'} />
                          </div>
                          <div className="cat-card-body">
                            <h3>{card.name || 'Без имени'}</h3>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <p className="muted">Пока нет котов на витрине.</p>;
                })()}
              </>
            )}
            <button className="secondary-button full" onClick={() => setViewingFriend(null)}>
              Закрыть профиль
            </button>
          </section>
        </div>
      )}

      <nav className="bottom-nav">
        {[
          ['home', Compass, 'Главная'],
          ['collection', Cat, 'Коллекция'],
          ['friends', Users, 'Друзья'],
          ['missions', Trophy, 'Задания'],
          ['profile', UserRound, 'Профиль'],
        ].map(([id, Icon, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon size={21} strokeWidth={tab === id ? 2.5 : 1.9} />
            <span>{label}</span>
            {id === 'collection' && cards.length > 0 && <i className="nav-dot" />}
            {id === 'friends' && friendRequests.length > 0 && <i className="nav-dot" />}
          </button>
        ))}
      </nav>

      {showInfo && (
        <div className="modal-backdrop" onClick={() => setShowInfo(false)}>
          <div className="info-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowInfo(false)}>
              <X size={19} />
            </button>
            <div className="modal-icon">🐾</div>
            <h2>Добро пожаловать в Cat Go!</h2>
            <p>Фотографируй котов, давай им имена, оформляй профиль и добавляй друзей.</p>
            <p><b>Важно:</b> сейчас фото сохраняется как карточка кота, а автоматическое распознавание котов и удаление фона ещё не подключены.</p>
            <button className="primary-button full" onClick={() => setShowInfo(false)}>Понятно!</button>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
