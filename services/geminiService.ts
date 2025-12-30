
import { GoogleGenAI, Type } from "@google/genai";
import { Expense, Category } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const parseExpenseInput = async (input: string): Promise<Partial<Expense>> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse this financial transaction entry into a JSON object: "${input}". 
      Available categories: Food & Drink, Transport, Shopping, Entertainment, Health, Utilities, Groceries, Other, Salary, Freelance, Investment, Gift.
      Current date is ${new Date().toLocaleDateString()}.
      Determine if it is an 'expense' or 'income'.
      If a specific date or relative date (like 'yesterday') is mentioned, parse it correctly into YYYY-MM-DD.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING },
            merchant: { type: Type.STRING },
            note: { type: Type.STRING },
            date: { type: Type.STRING, description: "ISO date string YYYY-MM-DD" },
            type: { type: Type.STRING, description: "'expense' or 'income'" },
          },
          required: ["amount", "currency", "category", "type"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return {};
  }
};

export const getSmartInsights = async (expenses: Expense[]): Promise<any> => {
  if (expenses.length === 0) return null;

  const dataContext = expenses.slice(0, 30).map(e => `${e.date}: ${e.type === 'income' ? '+' : '-'}${e.amount} ${e.currency} (${e.category})`).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these transactions (income and expenses) and provide 2-3 smart financial coaching insights. 
      Focus on net cashflow, saving rate, and habit detection.
      Keep it friendly, concise, and actionable. Use emojis.
      Data:\n${dataContext}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              type: { type: Type.STRING, description: "warning, tip, or praise" }
            }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Insight Error:", error);
    return [];
  }
};
