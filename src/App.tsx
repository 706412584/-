/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import { Upload, Sparkles, RefreshCw, Shirt, Briefcase, PartyPopper, Image as ImageIcon, Loader2, Languages } from "lucide-react";
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
  }
};

interface Outfit {
  type: "Casual" | "Business" | "Night Out";
  description: string;
  imagePrompt: string;
  imageUrl?: string;
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
                IMPORTANT: Provide the 'description' for each outfit in ${lang === 'zh' ? 'Chinese' : 'English'}.
                For each outfit, provide a detailed description of the other pieces (shoes, accessories, tops/bottoms) and a prompt for generating a clean flat-lay image of the entire outfit including the original item. The flat-lay should be on a neutral background.`,
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
                  },
                  required: ["type", "description", "imagePrompt"],
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
                    <h4 className="text-xl font-medium mb-4 flex items-center gap-2">
                      {t.lookTitle.replace("{type}", getTypeName(outfit.type))}
                    </h4>
                    <p className="text-[#666] text-sm leading-relaxed">
                      {outfit.description}
                    </p>
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
