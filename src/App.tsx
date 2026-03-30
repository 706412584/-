/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { Upload, Sparkles, RefreshCw, Shirt, Briefcase, PartyPopper, Image as ImageIcon, Loader2, Languages, Share2, Twitter, Facebook, Download, X, ShoppingCart, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Initialize AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type Language = "zh" | "en";

const translations = {
  zh: {
    title: "虚拟造型师",
    reset: "重置",
    heroTitle: "提升您的",
    heroTitleItalic: "日常",
    heroTitleEnd: "穿搭格调。",
    heroDesc: "上传您衣柜中的任何单品照片。我们的 AI 造型师将为您在任何场合策划三套完美的搭配。",
    uploadPrompt: "点击上传照片",
    uploadFormat: "支持 PNG, JPG，最大 10MB",
    change: "更换",
    styleMe: "开始搭配",
    analyzing: "正在分析您的单品...",
    visualizing: "正在生成 {type} 搭配...",
    curating: "我们的 AI 正在为您挑选完美的单品...",
    resultsTitle: "为您策划的搭配",
    regenerate: "重新生成",
    lookTitle: "{type} 风格搭配",
    casual: "休闲",
    business: "商务",
    nightOut: "晚宴/聚会",
    error: "出错了。请尝试换一张照片。",
    dismiss: "忽略",
    privacy: "隐私",
    terms: "条款",
    contact: "联系我们",
    footerDesc: "由 Gemini AI 提供支持。为您量身定制。",
    visualizingSmall: "生成中...",
    share: "分享",
    shareTitle: "分享搭配",
    shareDesc: "将这套搭配分享到社交媒体",
    download: "下载图片",
    close: "关闭",
    items: "搭配单品",
    estPrice: "预估",
    taobao: "淘宝",
    jd: "京东",
    pdd: "拼多多",
  },
  en: {
    title: "Virtual Stylist",
    reset: "Reset",
    heroTitle: "Elevate your",
    heroTitleItalic: "everyday",
    heroTitleEnd: "style.",
    heroDesc: "Upload a photo of any item in your wardrobe. Our AI stylist will curate three perfect outfits for any occasion.",
    uploadPrompt: "Click to upload photo",
    uploadFormat: "PNG, JPG up to 10MB",
    change: "Change",
    styleMe: "Style Me",
    analyzing: "Analyzing your item...",
    visualizing: "Visualizing {type} outfit...",
    curating: "Our AI is curating the perfect pieces for you...",
    resultsTitle: "Curated Outfits",
    regenerate: "Regenerate",
    lookTitle: "The {type} Look",
    casual: "Casual",
    business: "Business",
    nightOut: "Night Out",
    error: "Something went wrong. Please try again with a different photo.",
    dismiss: "Dismiss",
    privacy: "Privacy",
    terms: "Terms",
    contact: "Contact",
    footerDesc: "Powered by Gemini AI. Styled for you.",
    visualizingSmall: "Visualizing...",
    share: "Share",
    shareTitle: "Share Outfit",
    shareDesc: "Share this outfit to your social media",
    download: "Download Image",
    close: "Close",
    items: "Outfit Items",
    estPrice: "Est.",
    taobao: "Taobao",
    jd: "JD.com",
    pdd: "Pinduoduo",
  }
};

interface ClothingItem {
  name: string;
  estimatedPrice: number;
  searchKeyword: string;
}

interface Outfit {
  type: "Casual" | "Business" | "Night Out";
  description: string;
  imagePrompt: string;
  imageUrl?: string;
  items: ClothingItem[];
}

interface AnalysisResult {
  itemDescription: string;
  outfits: Outfit[];
}

export default function App() {
  const [lang, setLang] = useState<Language>("zh");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sharingOutfit, setSharingOutfit] = useState<Outfit | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang];

  const getTypeName = (type: string) => {
    if (type === "Casual") return t.casual;
    if (type === "Business") return t.business;
    if (type === "Night Out") return t.nightOut;
    return type;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImage(base64);
      setOutfits([]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleShare = (platform: string, outfit: Outfit) => {
    const text = `${t.lookTitle.replace("{type}", getTypeName(outfit.type))}\n\n${outfit.description}\n\nStyled by Virtual Stylist!`;
    const url = window.location.href;

    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
    } else if (platform === 'pinterest') {
      window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(text)}`);
    }
  };

  const handleDownload = (outfit: Outfit) => {
    if (!outfit.imageUrl) return;
    const a = document.createElement('a');
    a.href = outfit.imageUrl;
    a.download = `virtual-stylist-${outfit.type.toLowerCase().replace(' ', '-')}.png`;
    a.click();
  };

  const generateOutfits = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);
    setLoadingStep(t.analyzing);

    try {
      const base64Data = image.split(",")[1];
      const mimeType = image.split(";")[0].split(":")[1];

      // Step 1: Analyze the item and get outfit descriptions
      const analysisResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: `Analyze this clothing item. Identify its color palette, style, and type. Suggest 3 complete outfits featuring this item: 1. Casual, 2. Business, 3. Night Out. 
                IMPORTANT: Provide the 'description' and item 'name's in ${lang === 'zh' ? 'Chinese' : 'English'}.
                For each outfit, provide:
                1. A detailed description of the overall look.
                2. A prompt for generating a clean flat-lay image of the entire outfit.
                3. A list of 'items' (shoes, accessories, tops/bottoms) needed to complete the look (excluding the uploaded item). For each item, provide its name, a realistic estimated price in RMB (number only), and a highly specific search keyword IN CHINESE (for Taobao/JD/Pinduoduo).`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              itemDescription: { type: Type.STRING },
              outfits: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["Casual", "Business", "Night Out"] },
                    description: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          estimatedPrice: { type: Type.NUMBER },
                          searchKeyword: { type: Type.STRING },
                        },
                        required: ["name", "estimatedPrice", "searchKeyword"],
                      },
                    },
                  },
                  required: ["type", "description", "imagePrompt", "items"],
                },
              },
            },
            required: ["itemDescription", "outfits"],
          },
        },
      });

      const analysisResult = JSON.parse(analysisResponse.text) as AnalysisResult;
      setOutfits(analysisResult.outfits);

      // Step 2: Generate images for each outfit
      const updatedOutfits = [...analysisResult.outfits];
      
      for (let i = 0; i < updatedOutfits.length; i++) {
        setLoadingStep(t.visualizing.replace("{type}", getTypeName(updatedOutfits[i].type)));
        
        const imageResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [
              {
                text: `A clean, professional flat-lay fashion photography of a complete outfit. The outfit includes: ${updatedOutfits[i].imagePrompt}. Neutral background, soft studio lighting, high resolution, minimalist aesthetic.`,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K",
            },
          },
        });

        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            updatedOutfits[i].imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            setOutfits([...updatedOutfits]); // Update UI progressively
            break;
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(t.error);
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#1A1A1A] font-sans selection:bg-[#E5E1DA]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F9F8F6]/80 backdrop-blur-md border-b border-[#E5E1DA] px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white">
              <Shirt size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{t.title}</h1>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              className="flex items-center gap-2 text-sm font-medium text-[#666] hover:text-[#1A1A1A] transition-colors"
            >
              <Languages size={16} />
              {lang === "zh" ? "English" : "中文"}
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-[#666] hover:text-[#1A1A1A] transition-colors border-l border-[#E5E1DA] pl-6"
            >
              {t.reset}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="mb-16 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-light tracking-tighter mb-6 leading-[0.9]"
          >
            {t.heroTitle} <span className="italic font-serif">{t.heroTitleItalic}</span> {t.heroTitleEnd}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-[#666] max-w-2xl mx-auto mb-10"
          >
            {t.heroDesc}
          </motion.p>

          {/* Upload Area */}
          <div className="max-w-xl mx-auto">
            {!image ? (
              <motion.div 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square md:aspect-[16/9] border-2 border-dashed border-[#E5E1DA] rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-[#1A1A1A] transition-colors bg-white group"
              >
                <div className="w-16 h-16 bg-[#F3F1ED] rounded-full flex items-center justify-center mb-4 group-hover:bg-[#1A1A1A] group-hover:text-white transition-colors">
                  <Upload size={24} />
                </div>
                <p className="font-medium">{t.uploadPrompt}</p>
                <p className="text-sm text-[#999] mt-1">{t.uploadFormat}</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-6">
                <motion.img 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={image} 
                  alt="Uploaded item" 
                  className="w-full aspect-square md:aspect-[16/9] object-cover rounded-3xl shadow-xl"
                />
                <div className="flex items-center justify-center gap-4 w-full">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white border border-[#E5E1DA] text-[#1A1A1A] px-6 py-3 rounded-full font-medium flex items-center gap-2 hover:bg-[#F3F1ED] transition-colors shadow-sm"
                  >
                    <RefreshCw size={18} /> {t.change}
                  </button>
                  {!loading && outfits.length === 0 && (
                    <button 
                      onClick={generateOutfits}
                      className="bg-[#1A1A1A] text-white px-8 py-3 rounded-full font-medium flex items-center gap-2 hover:bg-black transition-colors shadow-md"
                    >
                      <Sparkles size={18} /> {t.styleMe}
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            )}
          </div>
        </section>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-[#F9F8F6]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="relative mb-8">
                <div className="w-24 h-24 border-4 border-[#E5E1DA] border-t-[#1A1A1A] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="text-[#1A1A1A] animate-pulse" size={32} />
                </div>
              </div>
              <h3 className="text-2xl font-medium mb-2">{loadingStep}</h3>
              <p className="text-[#666]">{t.curating}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        {outfits.length > 0 && (
          <section className="space-y-12">
            <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-6">
              <h3 className="text-3xl font-light tracking-tight">{t.resultsTitle}</h3>
              <button 
                onClick={generateOutfits}
                className="flex items-center gap-2 text-sm font-medium hover:underline"
              >
                <RefreshCw size={16} /> {t.regenerate}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {outfits.map((outfit, idx) => (
                <motion.div 
                  key={outfit.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group bg-white rounded-[2rem] overflow-hidden border border-[#E5E1DA] hover:shadow-2xl transition-all duration-500"
                >
                  <div className="aspect-square relative bg-[#F3F1ED] overflow-hidden">
                    {outfit.imageUrl ? (
                      <img 
                        src={outfit.imageUrl} 
                        alt={outfit.type} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#999]">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <p className="text-xs uppercase tracking-widest">{t.visualizingSmall}</p>
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm flex items-center gap-2">
                        {outfit.type === "Casual" && <ImageIcon size={14} />}
                        {outfit.type === "Business" && <Briefcase size={14} />}
                        {outfit.type === "Night Out" && <PartyPopper size={14} />}
                        {getTypeName(outfit.type)}
                      </span>
                    </div>
                  </div>
                  <div className="p-8">
                    <div className="flex items-start justify-between mb-4">
                      <h4 className="text-xl font-medium flex items-center gap-2">
                        {t.lookTitle.replace("{type}", getTypeName(outfit.type))}
                      </h4>
                      {outfit.imageUrl && (
                        <button 
                          onClick={() => setSharingOutfit(outfit)}
                          className="p-2 text-[#666] hover:text-[#1A1A1A] hover:bg-[#F3F1ED] rounded-full transition-colors"
                          title={t.share}
                        >
                          <Share2 size={18} />
                        </button>
                      )}
                    </div>
                    <p className="text-[#666] text-sm leading-relaxed">
                      {outfit.description}
                    </p>
                    
                    {outfit.items && outfit.items.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-[#E5E1DA]">
                        <h5 className="text-sm font-semibold uppercase tracking-wider text-[#1A1A1A] mb-4 flex items-center gap-2">
                          <ShoppingCart size={16} /> {t.items}
                        </h5>
                        <div className="space-y-3">
                          {outfit.items.map((item, i) => (
                            <div key={i} className="flex flex-col gap-2 p-3 bg-[#F9F8F6] rounded-xl border border-[#E5E1DA]/50">
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-[#1A1A1A] text-sm">{item.name}</span>
                                <span className="text-[#E65100] font-semibold text-sm whitespace-nowrap ml-2">
                                  ¥{item.estimatedPrice} <span className="text-xs text-[#999] font-normal">({t.estPrice})</span>
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <a 
                                  href={`https://s.taobao.com/search?q=${encodeURIComponent(item.searchKeyword)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium px-2.5 py-1 bg-[#FF5000]/10 text-[#FF5000] rounded-md hover:bg-[#FF5000]/20 transition-colors flex items-center gap-1"
                                >
                                  {t.taobao} <ExternalLink size={10} />
                                </a>
                                <a 
                                  href={`https://search.jd.com/Search?keyword=${encodeURIComponent(item.searchKeyword)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium px-2.5 py-1 bg-[#E1251B]/10 text-[#E1251B] rounded-md hover:bg-[#E1251B]/20 transition-colors flex items-center gap-1"
                                >
                                  {t.jd} <ExternalLink size={10} />
                                </a>
                                <a 
                                  href={`https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(item.searchKeyword)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium px-2.5 py-1 bg-[#E02E24]/10 text-[#E02E24] rounded-md hover:bg-[#E02E24]/20 transition-colors flex items-center gap-1"
                                >
                                  {t.pdd} <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-md mx-auto mt-12 p-6 bg-red-50 border border-red-100 rounded-2xl text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-4 text-sm font-medium text-red-500 hover:underline"
            >
              {t.dismiss}
            </button>
          </div>
        )}

        {/* Share Modal */}
        <AnimatePresence>
          {sharingOutfit && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
              onClick={() => setSharingOutfit(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-[#E5E1DA] flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold">{t.shareTitle}</h3>
                    <p className="text-sm text-[#666]">{t.shareDesc}</p>
                  </div>
                  <button 
                    onClick={() => setSharingOutfit(null)}
                    className="p-2 text-[#999] hover:text-[#1A1A1A] hover:bg-[#F3F1ED] rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6">
                  <div className="aspect-square rounded-2xl overflow-hidden mb-6 bg-[#F3F1ED]">
                    <img 
                      src={sharingOutfit.imageUrl} 
                      alt={sharingOutfit.type} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button 
                      onClick={() => handleShare('twitter', sharingOutfit)}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F3F1ED] hover:bg-[#E5E1DA] transition-colors font-medium text-[#1A1A1A]"
                    >
                      <Twitter size={18} /> Twitter
                    </button>
                    <button 
                      onClick={() => handleShare('facebook', sharingOutfit)}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F3F1ED] hover:bg-[#E5E1DA] transition-colors font-medium text-[#1A1A1A]"
                    >
                      <Facebook size={18} /> Facebook
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => handleShare('pinterest', sharingOutfit)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F3F1ED] hover:bg-[#E5E1DA] transition-colors font-medium text-[#1A1A1A] mb-6"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.624 0 12.017 0z"/>
                    </svg>
                    Pinterest
                  </button>
                  
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-[#E5E1DA]"></div>
                    <span className="flex-shrink-0 mx-4 text-[#999] text-xs uppercase tracking-wider">Or</span>
                    <div className="flex-grow border-t border-[#E5E1DA]"></div>
                  </div>
                  
                  <button 
                    onClick={() => handleDownload(sharingOutfit)}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A1A1A] text-white hover:bg-black transition-colors font-medium"
                  >
                    <Download size={18} /> {t.download}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E1DA] py-12 px-6 mt-24 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white">
              <Shirt size={16} />
            </div>
            <span className="font-semibold">{t.title}</span>
          </div>
          <p className="text-sm text-[#999]">
            {t.footerDesc}
          </p>
          <div className="flex gap-6 text-sm font-medium text-[#666]">
            <a href="#" className="hover:text-[#1A1A1A]">{t.privacy}</a>
            <a href="#" className="hover:text-[#1A1A1A]">{t.terms}</a>
            <a href="#" className="hover:text-[#1A1A1A]">{t.contact}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
