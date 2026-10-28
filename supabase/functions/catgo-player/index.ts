import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type TelegramUser = {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
};
const ALLOWED_BACKGROUNDS = new Set([
    "lavender", "sunset", "mint", "sky", "night", "peach",
]);
const ALLOWED_AVATAR_FRAMES = new Set(["none", "gold", "rose", "neon", "cosmic"]);
const ALLOWED_AVATAR_ACCESSORIES = new Set(["none", "bow", "glasses", "crown", "halo", "party"]);
const ALLOWED_CAT_CARD_STYLES = new Set(["classic", "rose", "mint", "night", "gold"]);
async function verifyTelegram(initData: string, botToken: string): Promise<TelegramUser | null> {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get("hash");
        if (!hash)
            return null;
        const pairs: string[] = [];
        params.forEach((value, key) => {
            if (key !== "hash")
                pairs.push(`${key}=${value}`);
        });
        pairs.sort();
        const dataCheckString = pairs.join("\n");
        const encoder = new TextEncoder();
        const secretKey = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const secret = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));
        const verificationKey = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = await crypto.subtle.sign("HMAC", verificationKey, encoder.encode(dataCheckString));
        const calculatedHash = Array.from(new Uint8Array(signature))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        if (calculatedHash.length !== hash.length)
            return null;
        let diff = 0;
        for (let i = 0; i < hash.length; i++) {
            diff |= calculatedHash.charCodeAt(i) ^ hash.charCodeAt(i);
        }
        if (diff !== 0)
            return null;
        const authDate = Number(params.get("auth_date"));
        const now = Math.floor(Date.now() / 1000);
        if (!authDate || authDate > now + 60 || now - authDate > 86400) {
            return null;
        }
        const user = JSON.parse(params.get("user") || "{}");
        if (!Number.isSafeInteger(user.id) || user.id <= 0)
            return null;
        return user as TelegramUser;
    }
    catch {
        return null;
    }
}
function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
function validId(value: unknown): value is number {
    const n = typeof value === "string" && value.trim()
        ? Number(value)
        : value;
    return Number.isSafeInteger(n) && Number(n) > 0;
}
function cleanUsername(value: unknown): string {
    if (typeof value !== "string")
        return "";
    return value.trim()
        .replace(/^@/, "")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 32);
}
function cleanShowcaseIds(value: unknown): string[] {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value
            .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))].slice(0, 6);
}
async function ensurePlayer(db: any, user: TelegramUser) {
    const telegramId = user.id;
    const { data: existing, error: lookupError } = await db
        .from("catgo_players")
        .select("telegram_id, avatar_url")
        .eq("telegram_id", telegramId)
        .maybeSingle();
    if (lookupError)
        throw lookupError;
    if (!existing) {
        const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
            "Котоисследователь";
        const { error } = await db.from("catgo_players").insert({
            telegram_id: telegramId,
            username: user.username ?? null,
            display_name: displayName.slice(0, 32),
            avatar_url: user.photo_url ?? null,
            background_key: "lavender",
            showcase_card_ids: [],
            avatar_frame_key: "none",
            avatar_accessory_key: "none",
            cat_card_style_key: "classic",
        });
        if (error)
            throw error;
    }
    else {
        const updates: Record<string, unknown> = {
            username: user.username ?? null,
        };
        if (!existing.avatar_url && user.photo_url) {
            updates.avatar_url = user.photo_url;
        }
        const { error } = await db.from("catgo_players")
            .update(updates)
            .eq("telegram_id", telegramId);
        if (error)
            throw error;
    }
}
async function getProfile(db: any, telegramId: number) {
    const { data, error } = await db.from("catgo_players")
        .select("telegram_id, username, display_name, avatar_url, background_key, created_at, showcase_card_ids, avatar_frame_key, avatar_accessory_key, cat_card_style_key")
        .eq("telegram_id", telegramId)
        .single();
    if (error)
        throw error;
    return data;
}
async function areFriends(db: any, firstId: number, secondId: number) {
    const { data, error } = await db.from("catgo_friendships")
        .select("id")
        .eq("status", "accepted")
        .or(`and(requester_id.eq.${firstId},addressee_id.eq.${secondId}),and(requester_id.eq.${secondId},addressee_id.eq.${firstId})`)
        .limit(1);
    if (error)
        throw error;
    return Boolean(data?.length);
}
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST")
        return json({ error: "Use POST" }, 405);
    try {
        const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!botToken || !supabaseUrl || !serviceKey) {
            return json({ error: "Server secrets are not configured" }, 500);
        }
        let body: any;
        try {
            body = await req.json();
        }
        catch {
            return json({ error: "Invalid JSON body" }, 400);
        }
        if (typeof body?.initData !== "string" || !body.initData) {
            return json({ error: "Open this game inside Telegram" }, 401);
        }
        const user = await verifyTelegram(body.initData, botToken);
        if (!user) {
            return json({ error: "Invalid or expired Telegram data" }, 401);
        }
        const db = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const me = user.id;
        const action = body?.action;
        await ensurePlayer(db, user);
        // Analyze cat photos on the server so the Gemini key never reaches the browser.
        if (action === "analyze_cat_photo") {
            const apiKey = Deno.env.get("GEMINI_API_KEY");
            if (!apiKey) {
                return json({ error: "Не настроен ключ распознавания. Проверь GEMINI_API_KEY в Supabase Secrets." }, 503);
            }
            const photoDataUrl = body.photo_data_url;
            if (typeof photoDataUrl !== "string" ||
                !/^data:image\/(jpeg|png|webp);base64,/i.test(photoDataUrl)) {
                return json({ error: "Передай фото в формате JPEG, PNG или WebP" }, 400);
            }
            const comma = photoDataUrl.indexOf(",");
            const mimeMatch = photoDataUrl.slice(0, comma).match(/^data:(image\/(?:jpeg|png|webp));base64$/i);
            const mimeType = mimeMatch?.[1]?.toLowerCase();
            const base64 = photoDataUrl.slice(comma + 1);
            if (!mimeType || !base64 || base64.length > 2_100_000 ||
                !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
                return json({ error: "Фото слишком большое или имеет неверный формат. Выбери фото поменьше." }, 413);
            }
            const geminiRequestBody = JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Проверь изображение для игры Cat Go. Определи, есть ли на фото настоящий кот или кошка, а не игрушка/рисунок/другое животное. Верни только один компактный JSON-объект без markdown и без пояснений. Все текстовые значения должны быть короткими (до 8 слов), массив visible_traits — максимум 4 элемента. Схема: {\"is_cat\":true,\"confidence\":0.95,\"coat_color\":\"рыжий\",\"pattern\":\"полосатый\",\"fur_length\":\"короткая шерсть\",\"eye_color\":\"зелёные\",\"visible_traits\":[\"белые лапы\"],\"breed_guess\":\"не удалось определить\",\"description_ru\":\"Рыжий полосатый кот с короткой шерстью\"}. confidence — число от 0 до 1. Не угадывай породу без надёжных оснований; неизвестные признаки заполняй строкой \"не удалось определить\". Если настоящего кота нет или уверенность ниже 0.65, is_cat=false. Не добавляй никакого текста до или после JSON." },
                        { inline_data: { mime_type: mimeType, data: base64 } },
                    ],
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0,
                    maxOutputTokens: 800,
                },
            });
            let geminiResponse: Response;
            const models = ["gemini-3.8-flash", "gemini-3.6-flash"];
            let lastFetchError: unknown = null;
            for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000);
                try {
                    geminiResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${models[modelIndex]}:generateContent`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-goog-api-key": apiKey,
                            },
                            body: geminiRequestBody,
                            signal: controller.signal,
                        },
                    );
                } catch (error) {
                    lastFetchError = error;
                    console.error("Gemini request failed or timed out for model:", models[modelIndex], error);
                    if (modelIndex < models.length - 1) {
                        console.warn("Trying fallback Gemini model:", models[modelIndex + 1]);
                        continue;
                    }
                    return json({
                        error: "Сервис распознавания не ответил за 25 секунд. Попробуй ещё раз чуть позже.",
                    }, 504);
                } finally {
                    clearTimeout(timeoutId);
                }
                if (geminiResponse.ok) break;
                const shouldFallback = [429, 500, 502, 503, 504].includes(geminiResponse.status);
                if (shouldFallback && modelIndex < models.length - 1) {
                    const details = await geminiResponse.text();
                    console.warn("Primary Gemini model unavailable; trying fallback:", models[modelIndex], geminiResponse.status, details.slice(0, 300));
                    continue;
                }
                break;
            }
            if (!geminiResponse.ok) {
                const details = await geminiResponse.text();
                console.error("Gemini analysis failed:", geminiResponse.status, details.slice(0, 1000));
                if (geminiResponse.status === 400 || geminiResponse.status === 403 || geminiResponse.status === 401) {
                    return json({ error: "Gemini не принял запрос. Проверь ключ и доступ к модели в Google AI Studio (код " + geminiResponse.status + ")." }, 502);
                }
                if (geminiResponse.status === 404) {
                    return json({ error: "Google не нашёл модель распознавания (404). Нужно проверить название модели в функции Supabase." }, 502);
                }
                if (geminiResponse.status === 429) {
                    return json({ error: "Лимит запросов распознавания исчерпан (429). Попробуй позже или проверь квоту Gemini." }, 429);
                }
                return json({ error: "Google Gemini временно не отвечает (код " + geminiResponse.status + "). Попробуй ещё раз; если повторится, проверь логи Edge Function в Supabase." }, 502);
            }
            const geminiData = await geminiResponse.json();
            const rawText = geminiData?.candidates?.[0]?.content?.parts
                ?.map((part: any) => typeof part.text === "string" ? part.text : "")
                .join("")
                .trim();
            if (!rawText) {
                return json({ error: "Не удалось распознать фото. Попробуй другое изображение." }, 502);
            }
            let analysis: any;
            try {
                const cleanedText = rawText
                    .replace(/^\uFEFF/, "")
                    .replace(/^\s*```(?:json)?\s*/i, "")
                    .replace(/\s*```\s*$/, "")
                    .trim();
                const objectStart = cleanedText.indexOf("{");
                const objectEnd = cleanedText.lastIndexOf("}");
                if (objectStart < 0 || objectEnd <= objectStart) {
                    throw new Error("No complete JSON object in Gemini response");
                }
                analysis = JSON.parse(cleanedText.slice(objectStart, objectEnd + 1));
            }
            catch {
                console.error("Gemini returned invalid JSON:", rawText.slice(0, 500));
                return json({ error: "Gemini вернул неполный ответ. Попробуй ещё раз — если ошибка повторится, пришли лог." }, 502);
            }
            const confidence = Number(analysis.confidence);
            const isCat = analysis.is_cat === true && Number.isFinite(confidence) && confidence >= 0.65;
            return json({
                analysis: {
                    is_cat: isCat,
                    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
                    coat_color: typeof analysis.coat_color === "string" ? analysis.coat_color.slice(0, 80) : "не удалось определить",
                    pattern: typeof analysis.pattern === "string" ? analysis.pattern.slice(0, 80) : "не удалось определить",
                    fur_length: typeof analysis.fur_length === "string" ? analysis.fur_length.slice(0, 80) : "не удалось определить",
                    eye_color: typeof analysis.eye_color === "string" ? analysis.eye_color.slice(0, 80) : "не удалось определить",
                    visible_traits: Array.isArray(analysis.visible_traits) ? analysis.visible_traits.filter((v: unknown) => typeof v === "string").slice(0, 8).map((v: string) => v.slice(0, 80)) : [],
                    breed_guess: typeof analysis.breed_guess === "string" ? analysis.breed_guess.slice(0, 100) : "не удалось определить",
                    description_ru: typeof analysis.description_ru === "string" ? analysis.description_ru.slice(0, 300) : "",
                },
            });
        }
        // Publish a cat sighting only after Telegram verification and server-side validation.
        if (action === "map_create_sighting") {
            const catName = typeof body.cat_name === "string" ? body.cat_name.trim() : "Котик";
            const description = typeof body.description === "string" ? body.description.trim() : "";
            const latitude = Number(body.latitude);
            const longitude = Number(body.longitude);
            const photoDataUrl = body.photo_data_url;
            if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
                !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
                return json({ error: "Выбери корректную точку на карте" }, 400);
            }
            if (!catName || catName.length > 80 || description.length > 500) {
                return json({ error: "Имя кота — до 80 символов, описание — до 500" }, 400);
            }
            if (typeof photoDataUrl !== "string" || !photoDataUrl.startsWith("data:image/jpeg;base64,")) {
                return json({ error: "Нужно загрузить фотографию кота в формате JPEG" }, 400);
            }
            const base64 = photoDataUrl.slice("data:image/jpeg;base64,".length);
            // 1.5 MB decoded maximum keeps requests bounded on mobile networks.
            if (!base64 || base64.length > 2_100_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
                return json({ error: "Фото слишком большое. Выбери другое фото" }, 413);
            }
            // Independently verify the uploaded image on the server; never trust a client-side flag.
            const visionKey = Deno.env.get("GEMINI_API_KEY");
            if (!visionKey) {
                return json({ error: "Не настроен ключ распознавания. Проверь GEMINI_API_KEY в Supabase Secrets." }, 503);
            }
            let catCheckResponse: Response;
            try {
                catCheckResponse = await fetch(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "x-goog-api-key": visionKey },
                        body: JSON.stringify({
                            contents: [{ parts: [
                                { text: "Определи, изображён ли на фото настоящий кот или кошка, а не игрушка, рисунок или другое животное. Верни только JSON: {\\"is_cat\\":true,\\"confidence\\":0.95}. Если кота нет или не уверен, is_cat=false. confidence от 0 до 1." },
                                { inline_data: { mime_type: "image/jpeg", data: base64 } },
                            ] }],
                            generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 100 },
                        }),
                        signal: AbortSignal.timeout(20000),
                    },
                );
            } catch (error) {
                console.error("Map cat verification failed:", error);
                return json({ error: "Не удалось проверить фото кота. Попробуй ещё раз." }, 502);
            }
            if (!catCheckResponse.ok) {
                console.error("Map cat verification API status:", catCheckResponse.status);
                return json({ error: "Сервис распознавания временно недоступен. Попробуй позже." }, 502);
            }
            const catCheckData = await catCheckResponse.json();
            const catCheckText = catCheckData?.candidates?.[0]?.content?.parts
                ?.map((part: any) => typeof part.text === "string" ? part.text : "")
                .join("").trim();
            let catCheck: any;
            try {
                const cleaned = String(catCheckText || "").replace(/^\\s*\`\`\`(?:json)?\\s*/i, "").replace(/\\s*\`\`\`$/, "").trim();
                catCheck = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
            } catch {
                return json({ error: "Не удалось подтвердить, что на фото кот. Попробуй другое фото." }, 422);
            }
            if (catCheck?.is_cat !== true || !Number.isFinite(Number(catCheck.confidence)) || Number(catCheck.confidence) < 0.65) {
                return json({ error: "ИИ не подтвердил, что на фото настоящий кот. Метка не опубликована." }, 422);
            }
            const { count, error: countError } = await db
                .from("cat_sightings")
                .select("id", { count: "exact", head: true })
                .eq("created_by_telegram_id", me)
                .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
            if (countError)
                throw countError;
            if ((count ?? 0) >= 5) {
                return json({ error: "Лимит публикаций — 5 находок в час. Попробуй позже" }, 429);
            }
            const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
            const photoPath = `${me}/${crypto.randomUUID()}.jpg`;
            const { error: uploadError } = await db.storage
                .from("cat-sightings")
                .upload(photoPath, bytes, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
            if (uploadError)
                throw uploadError;
            const { data: publicUrlData } = db.storage.from("cat-sightings").getPublicUrl(photoPath);
            // Publish approximate coordinates (rounded to about 100 m) to avoid exposing an exact home address.
            const { data: sighting, error: insertError } = await db.from("cat_sightings").insert({
                created_by_telegram_id: me,
                cat_name: catName,
                description: description || null,
                latitude: Math.round(latitude * 1000) / 1000,
                longitude: Math.round(longitude * 1000) / 1000,
                photo_url: publicUrlData.publicUrl,
                photo_storage_path: photoPath,
                status: "published",
                approximate_location: true,
            }).select("id, cat_name, description, latitude, longitude, photo_url, created_at").single();
            if (insertError) {
                await db.storage.from("cat-sightings").remove([photoPath]);
                throw insertError;
            }
            return json({ sighting });
        }
        // Delete a shared map sighting. Authorization is enforced on the server, not by the UI.
        if (action === "map_delete_sighting") {
            if (String(user.username ?? "").toLowerCase() !== "elchervei") {
                return json({ error: "Удалять находки может только администратор" }, 403);
            }
            const sightingId = typeof body.sightingId === "string" ? body.sightingId.trim() : "";
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sightingId)) {
                return json({ error: "Некорректный ID находки" }, 400);
            }
            const { data: sighting, error: lookupError } = await db
                .from("cat_sightings")
                .select("id, photo_storage_path")
                .eq("id", sightingId)
                .maybeSingle();
            if (lookupError)
                throw lookupError;
            if (!sighting) {
                return json({ error: "Находка уже удалена или не найдена" }, 404);
            }
            const { error: deleteError } = await db
                .from("cat_sightings")
                .delete()
                .eq("id", sightingId);
            if (deleteError)
                throw deleteError;
            if (typeof sighting.photo_storage_path === "string" && sighting.photo_storage_path) {
                const { error: storageError } = await db.storage
                    .from("cat-sightings")
                    .remove([sighting.photo_storage_path]);
                if (storageError) {
                    // The public map record is already gone; log orphaned storage for cleanup.
                    console.error("Could not remove deleted sighting photo from storage:", storageError);
                }
            }
            return json({ success: true });
        }
        // Публичные находки общей карты. Пользователь всё равно должен пройти Telegram initData.
        if (action === "map_sightings") {
            const { data, error } = await db
                .from("cat_sightings")
                .select("id, cat_name, description, latitude, longitude, photo_url, created_at")
                .eq("status", "published")
                .order("created_at", { ascending: false })
                .limit(100);
            if (error)
                throw error;
            return json({ sightings: data ?? [] });
        }
        // Загрузить собственный профиль.
        if (action === "profile") {
            return json({ profile: await getProfile(db, me) });
        }
        // Сохранить имя, аватар, фон и витрину.
        if (action === "update_profile") {
            const displayName = typeof body.display_name === "string"
                ? body.display_name.trim()
                : "";
            const avatarUrl = body.avatar_url === null
                ? null
                : body.avatar_url;
            const backgroundKey = body.background_key;
            if (!displayName || displayName.length > 32) {
                return json({
                    error: "Имя профиля должно содержать от 1 до 32 символов",
                }, 400);
            }
            if (avatarUrl !== null &&
                (typeof avatarUrl !== "string" || avatarUrl.length > 300000)) {
                return json({
                    error: "Аватар слишком большой или имеет неверный формат",
                }, 400);
            }
            if (typeof avatarUrl === "string" &&
                !avatarUrl.startsWith("data:image/jpeg;base64,") &&
                !/^https:\/\/.+/i.test(avatarUrl)) {
                return json({
                    error: "Аватар должен быть JPEG-изображением или HTTPS-ссылкой",
                }, 400);
            }
            if (!ALLOWED_BACKGROUNDS.has(backgroundKey)) {
                return json({ error: "Неизвестный фон профиля" }, 400);
            }
            const avatarFrameKey = body.avatar_frame_key ?? "none";
            const avatarAccessoryKey = body.avatar_accessory_key ?? "none";
            const catCardStyleKey = body.cat_card_style_key ?? "classic";
            if (!ALLOWED_AVATAR_FRAMES.has(avatarFrameKey)) {
                return json({ error: "Неизвестная рамка аватара" }, 400);
            }
            if (!ALLOWED_AVATAR_ACCESSORIES.has(avatarAccessoryKey)) {
                return json({ error: "Неизвестный аксессуар аватара" }, 400);
            }
            if (!ALLOWED_CAT_CARD_STYLES.has(catCardStyleKey)) {
                return json({ error: "Неизвестный стиль карточек" }, 400);
            }
            // Разрешаем добавить на витрину только собственные карточки.
            let showcaseIds: string[] = [];
            if (body.showcase_card_ids !== undefined) {
                const requestedIds = cleanShowcaseIds(body.showcase_card_ids);
                const { data: ownCards, error: cardsError } = await db
                    .from("catgo_cards")
                    .select("card_data")
                    .eq("telegram_id", me);
                if (cardsError)
                    throw cardsError;
                const ownedIds = new Set((ownCards ?? [])
                    .map((row: any) => row.card_data?.id)
                    .filter((id: unknown): id is string => typeof id === "string"));
                showcaseIds = requestedIds.filter((id) => ownedIds.has(id));
            }
            else {
                const current = await getProfile(db, me);
                showcaseIds = cleanShowcaseIds(current.showcase_card_ids);
            }
            const { error } = await db.from("catgo_players")
                .update({
                display_name: displayName,
                avatar_url: avatarUrl,
                background_key: backgroundKey,
                showcase_card_ids: showcaseIds,
                avatar_frame_key: avatarFrameKey,
                avatar_accessory_key: avatarAccessoryKey,
                cat_card_style_key: catCardStyleKey,
            })
                .eq("telegram_id", me);
            if (error)
                throw error;
            return json({
                success: true,
                profile: await getProfile(db, me),
            });
        }
        // Публичный профиль друга и только его выбранные карточки.
        if (action === "public_profile") {
            const target = Number(body.telegramId);
            if (!validId(target) || target === me) {
                return json({ error: "Некорректный профиль" }, 400);
            }
            const friendship = await areFriends(db, me, target);
            if (!friendship) {
                return json({
                    error: "Посмотреть профиль можно только у друга",
                }, 403);
            }
            const { data: targetProfile, error: profileError } = await db
                .from("catgo_players")
                .select("telegram_id, username, display_name, avatar_url, background_key, created_at, showcase_card_ids, avatar_frame_key, avatar_accessory_key, cat_card_style_key")
                .eq("telegram_id", target)
                .maybeSingle();
            if (profileError)
                throw profileError;
            if (!targetProfile) {
                return json({ error: "Игрок не найден" }, 404);
            }
            const showcaseIds = cleanShowcaseIds(targetProfile.showcase_card_ids);
            let showcaseCards: any[] = [];
            if (showcaseIds.length) {
                const { data: rows, error: cardsError } = await db
                    .from("catgo_cards")
                    .select("id, card_data, created_at")
                    .eq("telegram_id", target)
                    .order("created_at", { ascending: false });
                if (cardsError)
                    throw cardsError;
                const wanted = new Set(showcaseIds);
                showcaseCards = (rows ?? []).filter((row: any) => wanted.has(row.card_data?.id));
            }
            return json({
                profile: targetProfile,
                cards: showcaseCards,
                showcase_card_ids: showcaseIds,
            });
        }
        // Загрузить только собственные карточки.
        if (action === "get_cards") {
            const { data, error } = await db.from("catgo_cards")
                .select("id, card_data, created_at")
                .eq("telegram_id", me)
                .order("created_at", { ascending: false });
            if (error)
                throw error;
            return json({ cards: data ?? [] });
        }
        // Сохранить карточку в собственную коллекцию.
        if (action === "save_card") {
            if (!body.card ||
                typeof body.card !== "object" ||
                Array.isArray(body.card)) {
                return json({ error: "Invalid card data" }, 400);
            }
            const serialized = JSON.stringify(body.card);
            if (serialized.length > 500000) {
                return json({ error: "Карточка слишком большая" }, 400);
            }
            if (typeof body.card.id !== "string" || !body.card.id) {
                return json({ error: "Card ID is required" }, 400);
            }
            if (typeof body.card.name !== "string" ||
                !body.card.name.trim() ||
                body.card.name.length > 40) {
                return json({
                    error: "Имя кота должно содержать от 1 до 40 символов",
                }, 400);
            }
            const { data: existing, error: duplicateError } = await db
                .from("catgo_cards")
                .select("id")
                .eq("telegram_id", me)
                .eq("card_data->>id", body.card.id)
                .maybeSingle();
            if (duplicateError)
                throw duplicateError;
            if (existing) {
                return json({ error: "Эта карточка уже сохранена" }, 409);
            }
            // Reject the same compressed photo even if the client generated a fresh card ID.
            if (typeof body.card.photoHash === "string" && /^[a-f0-9]{64}$/.test(body.card.photoHash)) {
                const { data: photoDuplicate, error: photoDuplicateError } = await db
                    .from("catgo_cards")
                    .select("id")
                    .eq("telegram_id", me)
                    .eq("card_data->>photoHash", body.card.photoHash)
                    .limit(1)
                    .maybeSingle();
                if (photoDuplicateError)
                    throw photoDuplicateError;
                if (photoDuplicate) {
                    return json({ error: "Это фото уже есть в твоей коллекции" }, 409);
                }
            }
            const { data, error } = await db.from("catgo_cards")
                .insert({ telegram_id: me, card_data: body.card })
                .select("id, card_data, created_at")
                .single();
            if (error)
                throw error;
            return json({ card: data }, 201);
        }
        // Переименовать собственную карточку.
        if (action === "rename_card") {
            const cardId = body.cardId;
            const name = typeof body.name === "string"
                ? body.name.trim()
                : "";
            if (typeof cardId !== "string" || !cardId) {
                return json({ error: "cardId is required" }, 400);
            }
            if (!name || name.length > 40) {
                return json({
                    error: "Имя кота должно содержать от 1 до 40 символов",
                }, 400);
            }
            const { data: rows, error: lookupError } = await db
                .from("catgo_cards")
                .select("id, card_data")
                .eq("telegram_id", me);
            if (lookupError)
                throw lookupError;
            const row = (rows ?? []).find((item: any) => item.card_data?.id === cardId || item.id === cardId);
            if (!row)
                return json({ error: "Card not found" }, 404);
            const updatedCard = { ...row.card_data, name };
            const { error } = await db.from("catgo_cards")
                .update({ card_data: updatedCard })
                .eq("telegram_id", me)
                .eq("id", row.id);
            if (error)
                throw error;
            return json({ success: true, card: updatedCard });
        }
        // Удалить собственную карточку и убрать её с витрины.
        if (action === "delete_card") {
            const cardId = body.cardId;
            if (typeof cardId !== "string" || !cardId) {
                return json({ error: "cardId is required" }, 400);
            }
            const { data: rows, error: lookupError } = await db
                .from("catgo_cards")
                .select("id, card_data")
                .eq("telegram_id", me);
            if (lookupError)
                throw lookupError;
            const row = (rows ?? []).find((item: any) => item.card_data?.id === cardId || item.id === cardId);
            if (!row)
                return json({ error: "Card not found" }, 404);
            const { error: deleteError } = await db.from("catgo_cards")
                .delete()
                .eq("telegram_id", me)
                .eq("id", row.id);
            if (deleteError)
                throw deleteError;
            const profile = await getProfile(db, me);
            const nextShowcase = cleanShowcaseIds(profile.showcase_card_ids).filter((id) => id !== row.card_data?.id);
            const { error: profileUpdateError } = await db.from("catgo_players")
                .update({ showcase_card_ids: nextShowcase })
                .eq("telegram_id", me);
            if (profileUpdateError)
                throw profileUpdateError;
            return json({ success: true });
        }
        // Найти игроков по Telegram username.
        if (action === "search_players") {
            const query = cleanUsername(body.query);
            if (query.length < 2)
                return json({ players: [] });
            const { data, error } = await db.from("catgo_players")
                .select("telegram_id, username, display_name, avatar_url, background_key")
                .neq("telegram_id", me)
                .ilike("username", `%${query}%`)
                .limit(20);
            if (error)
                throw error;
            return json({ players: data ?? [] });
        }
        // Отправить запрос в друзья или принять встречный запрос.
        if (action === "send_friend_request") {
            const target = Number(body.telegramId);
            if (!validId(target) || target === me) {
                return json({ error: "Invalid player" }, 400);
            }
            const { data: targetPlayer, error: targetError } = await db
                .from("catgo_players")
                .select("telegram_id")
                .eq("telegram_id", target)
                .maybeSingle();
            if (targetError)
                throw targetError;
            if (!targetPlayer) {
                return json({
                    error: "Игрок не найден. Он должен сначала открыть Cat Go.",
                }, 404);
            }
            const { data: relations, error: relationError } = await db
                .from("catgo_friendships")
                .select("id, requester_id, addressee_id, status")
                .or(`and(requester_id.eq.${me},addressee_id.eq.${target}),and(requester_id.eq.${target},addressee_id.eq.${me})`);
            if (relationError)
                throw relationError;
            const relation = (relations ?? [])[0];
            if (relation?.status === "accepted") {
                return json({ success: true, status: "accepted" });
            }
            if (relation?.status === "pending") {
                if (Number(relation.requester_id) === target &&
                    Number(relation.addressee_id) === me) {
                    const { error } = await db.from("catgo_friendships")
                        .update({
                        status: "accepted",
                        updated_at: new Date().toISOString(),
                    })
                        .eq("id", relation.id);
                    if (error)
                        throw error;
                    return json({ success: true, status: "accepted" });
                }
                return json({ success: true, status: "pending" });
            }
            const { error } = await db.from("catgo_friendships").insert({
                requester_id: me,
                addressee_id: target,
                status: "pending",
            });
            if (error) {
                const { data: current } = await db.from("catgo_friendships")
                    .select("id, requester_id, addressee_id, status")
                    .or(`and(requester_id.eq.${me},addressee_id.eq.${target}),and(requester_id.eq.${target},addressee_id.eq.${me})`);
                const relationNow = (current ?? [])[0];
                if (relationNow?.status === "accepted" ||
                    relationNow?.status === "pending") {
                    return json({
                        success: true,
                        status: relationNow.status,
                    });
                }
                throw error;
            }
            return json({ success: true, status: "pending" }, 201);
        }
        // Получить входящие заявки.
        if (action === "friend_requests") {
            const { data: requests, error } = await db.from("catgo_friendships")
                .select("id, requester_id, created_at")
                .eq("addressee_id", me)
                .eq("status", "pending")
                .order("created_at", { ascending: false });
            if (error)
                throw error;
            const ids = [...new Set((requests ?? []).map((request: any) => Number(request.requester_id)))];
            let profiles: any[] = [];
            if (ids.length) {
                const { data, error: profilesError } = await db
                    .from("catgo_players")
                    .select("telegram_id, username, display_name, avatar_url, background_key")
                    .in("telegram_id", ids);
                if (profilesError)
                    throw profilesError;
                profiles = data ?? [];
            }
            const profileById = new Map(profiles.map((item: any) => [
                Number(item.telegram_id),
                item,
            ]));
            return json({
                requests: (requests ?? []).map((request: any) => ({
                    ...request,
                    profile: profileById.get(Number(request.requester_id)) ?? null,
                })),
            });
        }
        // Принять или отклонить заявку.
        if (action === "respond_friend_request") {
            const requestId = body.requestId;
            const decision = body.decision;
            if (typeof requestId !== "string" ||
                !["accepted", "declined"].includes(decision)) {
                return json({ error: "Invalid request" }, 400);
            }
            if (decision === "accepted") {
                const { data, error } = await db.from("catgo_friendships")
                    .update({
                    status: "accepted",
                    updated_at: new Date().toISOString(),
                })
                    .eq("id", requestId)
                    .eq("addressee_id", me)
                    .eq("status", "pending")
                    .select("id")
                    .maybeSingle();
                if (error)
                    throw error;
                if (!data)
                    return json({ error: "Request not found" }, 404);
            }
            else {
                const { data, error } = await db.from("catgo_friendships")
                    .delete()
                    .eq("id", requestId)
                    .eq("addressee_id", me)
                    .eq("status", "pending")
                    .select("id")
                    .maybeSingle();
                if (error)
                    throw error;
                if (!data)
                    return json({ error: "Request not found" }, 404);
            }
            return json({ success: true, status: decision });
        }
        // Список друзей.
        if (action === "friends_list") {
            const { data: relations, error } = await db.from("catgo_friendships")
                .select("id, requester_id, addressee_id")
                .eq("status", "accepted")
                .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
            if (error)
                throw error;
            const ids = [...new Set((relations ?? []).map((relation: any) => Number(relation.requester_id) === me
                    ? Number(relation.addressee_id)
                    : Number(relation.requester_id)))];
            if (!ids.length)
                return json({ friends: [] });
            const { data: friends, error: friendsError } = await db
                .from("catgo_players")
                .select("telegram_id, username, display_name, avatar_url, background_key")
                .in("telegram_id", ids);
            if (friendsError)
                throw friendsError;
            return json({ friends: friends ?? [] });
        }
        // Удалить друга.
        if (action === "remove_friend") {
            const target = Number(body.telegramId);
            if (!validId(target) || target === me) {
                return json({ error: "Invalid player" }, 400);
            }
            const { data, error } = await db.from("catgo_friendships")
                .delete()
                .eq("status", "accepted")
                .or(`and(requester_id.eq.${me},addressee_id.eq.${target}),and(requester_id.eq.${target},addressee_id.eq.${me})`)
                .select("id");
            if (error)
                throw error;
            if (!data?.length) {
                return json({ error: "Friendship not found" }, 404);
            }
            return json({ success: true });
        }
        return json({ error: "Unknown action" }, 400);
    }
    catch (error) {
        console.error("catgo-player error:", error);
        return json({
            error: error instanceof Error ? error.message : "Server error",
        }, 500);
    }
});