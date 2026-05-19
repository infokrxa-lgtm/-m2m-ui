
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const port = process.env.PORT || 4300;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

let krxaLog = [];
let aiMemory = [];
let chats = [];
let userSites = { travel:{}, game:{}, talk:{}, business:{}, field:{} };

const uiConfig = {
  productName: "말대말",
  headline: "상황에서 행동을 고르면, 말은 자동으로 나옵니다.",
  subtitle: "통역은 기본입니다. 외부 서비스와 연결되는 실전 행동 대화 플랫폼입니다.",
  order: ["travel", "game", "talk", "business", "field"],
  domains: {
    travel: {
      label: "여행", icon: "✈️", context: "여행 / 현지인 / 요청", sample: "예약했어요",
      flow: ["도착", "보기", "질문", "요청", "확인", "공유"],
      needs: [
        { key:"map", label:"길 찾기", desc:"지도, 교통, 경로 확인" },
        { key:"hotel", label:"예약 확인", desc:"숙소, 체크인, 예약 확인" },
        { key:"food", label:"주문하기", desc:"식당, 메뉴, 결제" },
        { key:"translate", label:"외부 번역앱", desc:"사용자가 선택한 번역앱 연결" },
        { key:"help", label:"도움 요청", desc:"긴급, 분실, 문의" }
      ],
      services: {
        map: [
          { id:"base_maps_google", name:"Google Maps", desc:"지도/경로 찾기", url:"https://maps.google.com" },
          { id:"base_maps_naver", name:"Naver Map", desc:"국내 지도/길찾기", url:"https://map.naver.com" },
          { id:"base_maps_kakao", name:"Kakao Map", desc:"국내 위치/교통", url:"https://map.kakao.com" }
        ],
        hotel: [
          { id:"base_booking", name:"Booking.com", desc:"숙소 예약 확인/검색", url:"https://www.booking.com" },
          { id:"base_agoda", name:"Agoda", desc:"호텔/숙소 예약", url:"https://www.agoda.com" }
        ],
        food: [
          { id:"base_food_google", name:"Google Restaurants", desc:"주변 식당 찾기", url:"https://www.google.com/search?q=restaurants+near+me" }
        ],
        translate: [
          { id:"base_google_translate", name:"Google Translate", desc:"외부 번역앱", url:"https://translate.google.com" },
          { id:"base_papago", name:"Papago", desc:"외부 번역앱", url:"https://papago.naver.com" }
        ],
        help: [
          { id:"base_embassy", name:"Embassy Search", desc:"대사관/영사관 정보 검색", url:"https://www.google.com/search?q=embassy+near+me" }
        ]
      },
      actions: {
        reserve: { label:"예약 확인", output:"I have a reservation." },
        direction: { label:"길 묻기", output:"Could you tell me how to get there?" },
        order: { label:"주문하기", output:"Can I order this, please?" },
        translate: { label:"외부 번역 연결", output:"Let me translate this." },
        help: { label:"도움 요청", output:"Could you help me?" }
      }
    },
    game: {
      label:"게임", icon:"🎮", context:"게임 / 긴급 / 팀원", sample:"뒤에 적 있어",
      flow:["보기", "듣기", "판단", "말하기"],
      needs:[{key:"team",label:"팀 보이스",desc:"팀원과 빠른 소통"}],
      services:{team:[{id:"base_discord",name:"Discord",desc:"게임 음성/커뮤니티",url:"https://discord.com"}]},
      actions:{warn:{label:"경고하기",output:"Behind!"},location:{label:"위치 알려주기",output:"Enemy behind you!"},avoid:{label:"피하라고 하기",output:"Get out of there!"}}
    },
    talk: {
      label:"대화", icon:"💬", context:"친구 / 일상 / 자연 대화", sample:"뭐하고 있어?",
      flow:["듣기","이해","대답","이어가기"],
      needs:[{key:"chat",label:"대화 연결",desc:"메신저/커뮤니티 연결"}],
      services:{chat:[{id:"base_whatsapp",name:"WhatsApp",desc:"글로벌 메신저",url:"https://www.whatsapp.com"}]},
      actions:{greet:{label:"인사하기",output:"Hey, how are you?"},ask:{label:"질문하기",output:"What are you up to?"},react:{label:"공감하기",output:"That sounds great."}}
    },
    business: {
      label:"업무", icon:"💼", context:"업무 / 회의 / 조율", sample:"일정 조율이 필요합니다",
      flow:["자료 보기","듣기","의도 파악","대응"],
      needs:[{key:"meeting",label:"회의",desc:"화상회의/일정"}],
      services:{meeting:[{id:"base_zoom",name:"Zoom",desc:"화상회의",url:"https://zoom.us"}]},
      actions:{accept:{label:"수락하기",output:"That works for me."},reject:{label:"거절하기",output:"I’m afraid that won’t work."},adjust:{label:"조율하기",output:"Could we adjust the schedule?"}}
    },
    field: {
      label:"현장", icon:"🏗", context:"현장 / 위험 / 지시", sample:"위험해요",
      flow:["상황 보기","소리 듣기","위험 판단","지시"],
      needs:[{key:"safety",label:"안전",desc:"위험 안내/지시"}],
      services:{safety:[{id:"base_safety",name:"Safety Manual Search",desc:"안전 수칙 검색",url:"https://www.google.com/search?q=workplace+safety+manual"}]},
      actions:{stop:{label:"멈추라고 하기",output:"Stop."},avoid:{label:"피하라고 하기",output:"Move away."},help:{label:"도움 요청",output:"Help me here."}}
    }
  }
};

const aiDictionary = [
  { domain:"travel", ko:"예약", intent:"reserve", en:"I have a reservation.", reason:"여행 예약 확인" },
  { domain:"travel", ko:"길", intent:"direction", en:"Could you tell me how to get there?", reason:"길 찾기" },
  { domain:"travel", ko:"주문", intent:"order", en:"Can I order this, please?", reason:"주문" },
  { domain:"travel", ko:"도움", intent:"help", en:"Could you help me?", reason:"도움 요청" },
  { domain:"game", ko:"뒤", intent:"warn", en:"Behind!", reason:"게임 긴급 경고" },
  { domain:"business", ko:"일정", intent:"adjust", en:"Could we adjust the schedule?", reason:"업무 조율" },
  { domain:"field", ko:"위험", intent:"stop", en:"Stop. It is dangerous.", reason:"현장 위험" }
];

function log(type, payload) {
  const item = { id:"krxa_" + Date.now(), type, payload, created_at:new Date().toISOString() };
  krxaLog.unshift(item);
  krxaLog = krxaLog.slice(0, 300);
  return item;
}
function remember(type, payload) {
  const item = { id:"mem_" + Date.now(), type, payload, created_at:new Date().toISOString() };
  aiMemory.unshift(item);
  aiMemory = aiMemory.slice(0, 300);
  return item;
}
function tempKrxai({ text="", domain="travel", action="", mode="assist" }) {
  const d = uiConfig.domains[domain] || uiConfig.domains.travel;
  if (action && d.actions[action]) {
    return { input:text||d.sample, domain, mode, intent:action, output:d.actions[action].output, reason:"사용자 행동 선택 기반", source:"action_map" };
  }
  const lower = String(text).toLowerCase();
  const hit = aiDictionary.find(x => x.domain === domain && (String(text).includes(x.ko) || lower.includes(x.intent)))
           || aiDictionary.find(x => String(text).includes(x.ko) || lower.includes(x.intent));
  if (hit) return { input:text, domain, mode, intent:hit.intent, output:hit.en, reason:hit.reason, source:"temp_krxai_dictionary" };
  const fallback = { travel:"Could you help me with this?", game:"Watch out!", talk:"Could you say that again?", business:"Could you clarify that, please?", field:"Please stop and check." };
  return { input:text, domain, mode, intent:"fallback", output:fallback[domain] || "Could you help me?", reason:"임시 KRXAI fallback", source:"temp_krxai_fallback" };
}

app.get("/health", (req,res)=>res.json({ok:true, service:"M2M RENDER API AI V06", public_entry:"/", dev_entry:"/dev", krxa_entry:"/krxa", ai_entry:"/api/ai"}));
app.get("/api/ui/config", (req,res)=>res.json({ok:true, config:uiConfig}));
app.get("/api/user-sites", (req,res)=>res.json({ok:true, userSites}));
app.post("/api/user-sites", (req,res)=>{
  const {domain, needKey, name, url, desc="사용자 등록 사이트"} = req.body || {};
  if(!domain || !needKey || !name || !url) return res.status(400).json({ok:false, error:"missing_required_fields"});
  userSites[domain] ||= {};
  userSites[domain][needKey] ||= [];
  const item = {id:"site_"+Date.now(), name, url: url.startsWith("http")?url:"https://"+url, desc, user_added:true, created_at:new Date().toISOString()};
  userSites[domain][needKey].push(item);
  log("user_site_added", {domain, needKey, name, url:item.url});
  remember("user_site_preference", {domain, needKey, name, url:item.url});
  res.json({ok:true, site:item, userSites});
});
app.delete("/api/user-sites/:domain/:needKey/:siteId", (req,res)=>{
  const {domain, needKey, siteId} = req.params;
  const list = userSites?.[domain]?.[needKey] || [];
  userSites[domain][needKey] = list.filter(s=>s.id!==siteId);
  log("user_site_deleted", {domain, needKey, siteId});
  res.json({ok:true, userSites});
});
app.post("/api/ai", (req,res)=>{
  const result = tempKrxai(req.body || {});
  const event = {event_id:"ai_"+Date.now(), request:req.body || {}, result, created_at:new Date().toISOString()};
  log("api_ai_called", event);
  remember("language_response", event);
  res.json({ok:true, result, event});
});
app.get("/api/ai/memory", (req,res)=>res.json({ok:true, memory:aiMemory}));
app.post("/api/chat/start", (req,res)=>{
  const {domain="travel", action="reserve", input=""} = req.body || {};
  const d = uiConfig.domains[domain] || uiConfig.domains.travel;
  const ai = tempKrxai({text:input||d.sample, domain, action, mode:"chat_start"});
  const chat = {chat_id:"chat_"+Date.now(), domain, action, title:`${d.label} · ${d.actions[action]?.label || ai.intent}`, created_at:new Date().toISOString(), messages:[
    {role:"system", text:`상황: ${d.context}`, at:new Date().toISOString()},
    {role:"other", text:input||d.sample, at:new Date().toISOString()},
    {role:"me", text:ai.output, at:new Date().toISOString()}
  ]};
  chats.unshift(chat);
  log("chat_started", {chat_id:chat.chat_id, domain, action});
  remember("chat_started_memory", {chat_id:chat.chat_id, ai});
  res.json({ok:true, chat});
});
app.post("/api/chat/:chatId/message", (req,res)=>{
  const chat = chats.find(c=>c.chat_id===req.params.chatId);
  if(!chat) return res.status(404).json({ok:false, error:"chat_not_found"});
  const {role="me", text=""} = req.body || {};
  chat.messages.push({role, text, at:new Date().toISOString()});
  chat.messages = chat.messages.slice(-20);
  log("chat_message", {chat_id:chat.chat_id, role, text});
  remember("chat_message_memory", {chat_id:chat.chat_id, role, text});
  res.json({ok:true, chat});
});
app.get("/api/chats", (req,res)=>res.json({ok:true, chats}));
app.get("/api/krxa/log", (req,res)=>res.json({ok:true, krxaLog, userSites, chats, aiMemory}));

app.listen(port, ()=>console.log(`M2M RENDER API AI V06 running on :${port}`));
