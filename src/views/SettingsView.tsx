import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinanceData } from "@/hooks/useFinanceData";
import { dbService } from "@/services/db";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Star,
  Trash2,
  Edit2,
  X,
  Check,
  Sparkles,
  Minus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import { AUTO_RULE_PATTERNS } from "@/constants/autoRules";
import { DEFAULT_CATEGORIES } from "../constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { RuleCondition, RuleField } from "@/types";

export const SettingsView = () => {
  const { categories, rules, transactions, loading, refresh, applyRules } =
    useFinanceData();
  const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([
    { field: "recipient", pattern: "" },
  ]);
  const [newRuleCategory, setNewRuleCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [recategorizing, setRecategorizing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [rulesCollapsed, setRulesCollapsed] = useState(false);
  const [expandedCatIds, setExpandedCatIds] = useState<Record<string, boolean>>({});

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCatIds((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const sortedTopLevelCategories = useMemo(() => {
    const parentCats = categories.filter((c) => !c.parentId);
    const typeOrder = {
      income: 1,
      expense: 2,
      both: 3,
    };
    return [...parentCats].sort((a, b) => {
      const orderA = typeOrder[a.type as keyof typeof typeOrder] || 4;
      const orderB = typeOrder[b.type as keyof typeof typeOrder] || 4;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name, "et");
    });
  }, [categories]);

  const sortedRules = useMemo(() => {
    const getCategoryName = (categoryId: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return "Tundmatu";
      const parent = cat.parentId
        ? categories.find((p) => p.id === cat.parentId)
        : null;
      return parent ? `${parent.name} > ${cat.name}` : cat.name;
    };

    return [...rules].sort((a, b) => {
      const nameA = getCategoryName(a.categoryId).toLowerCase();
      const nameB = getCategoryName(b.categoryId).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [rules, categories]);

  const handleClearAllData = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    if (!window.confirm("Oled sa kindel? See kustutab KÕIK sinu tehingud, kategooriad ja reeglid jäädavalt!")) {
      return;
    }

    setClearing(true);
    try {
      await dbService.clearAllData(userId);
      toast.success("Kõik andmed on kustutatud");
      refresh();
    } catch (e: any) {
      toast.error("Andmete kustutamine ebaõnnestus");
    } finally {
      setClearing(false);
    }
  };

  const handleRecategorizeAll = async () => {
    if (!transactions.length || !rules.length)
      return toast.info("Pole tehinguid või reegleid");

    setRecategorizing(true);
    let count = 0;
    try {
      // Logic to find transactions that would change
      const updates = transactions.filter((t) => {
        const newCatId = applyRules(t, rules);
        return newCatId && newCatId !== t.categoryId;
      });

      if (updates.length === 0) {
        toast.info("Kõik kanded on juba õigesti kategoriseeritud");
        return;
      }

      await Promise.all(
        updates.map((t) => {
          const newCatId = applyRules(t, rules);
          return dbService.updateTransaction(t.id, { categoryId: newCatId! });
        }),
      );

      toast.success(`Uuendatud ${updates.length} kannet`);
    } catch (e: any) {
      toast.error("Kategoriseerimine ebaõnnestus");
    } finally {
      setRecategorizing(false);
    }
  };

  const handleAutoGenerateRules = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setAutoGenerating(true);
    try {
      // 1. Gather all unique existing patterns to avoid duplicates (checking both pattern and inner conditions)
      const existingPatterns = new Set<string>();
      for (const r of rules) {
        if (r.pattern) {
          existingPatterns.add(r.pattern.toUpperCase().trim());
        }
        if (r.conditions) {
          for (const c of r.conditions) {
            if (c.pattern) {
              existingPatterns.add(c.pattern.toUpperCase().trim());
            }
          }
        }
      }

      const newRulesToCreate: any[] = [];

      // 2. STAGE A: Map base Estonian merchants to correct new categories if they doesn't exist
      const staticEstonianRules = [
        // Shopping & Groceries
        { keywords: ['MAXIMA', 'RIMI', 'SELVER', 'PRISMA', 'COOP', 'LIDL', 'GROSSI', 'SÄÄSTUKAART'], category: 'Toidupood' },
        // Eating out
        { keywords: ['BOLT.EU/FOOD', 'WOLT', 'FUDY', 'HESBURGER', 'MCDONALDS', 'KEBAB', 'PIZZA', 'BURGER'], category: 'Väljas söömine' },
        // Transport & Fuel
        { keywords: ['CIRCLE K', 'OLEREX', 'NESTÉ', 'ALEXELA', 'KÜTUS', 'STATOIL'], category: 'Kütus' },
        { keywords: ['BOLT.EU/RIDE', 'UBER', 'ELRON', 'TAKSO', 'BUSSIJAAM'], category: 'Transport' },
        // Communication
        { keywords: ['TELIA', 'ELISA', 'TELE2'], category: 'Internet, telefon, TV' },
        // Utilities
        { keywords: ['ELEKTRILEVI', 'EESTI ENERGIA'], category: 'Elekter' },
        { keywords: ['GAAS', 'EESTI GAAS'], category: 'Gaas' },
        { keywords: ['TALLINNA VESI'], category: 'Vesi' },
        // Income
        { keywords: ['TÖÖTASU', 'PALK'], category: 'Palk' },
        { keywords: ['DIVIDEND', 'DIVIDENDS'], category: 'Dividenditulu' },
        { keywords: ['INTRESS', 'INTRESSID'], category: 'Intressitulu' },
        { keywords: ['LAPSETOETUS', 'SOTSIAALKINDLUSTUSAMET'], category: 'Peretoetus' },
        { keywords: ['TÖÖTUKASSA'], category: 'Töötutoetus' },
        // Finance & banking
        { keywords: ['LHV PANK', 'SWEDBANK', 'SEB PANK', 'COOP PANK', 'FINANTSTEENUS', 'KAARDITASU'], category: 'Finantsteenused' },
        // Home loan
        { keywords: ['KODULAEN', 'HIPOTEEK', 'KRT-LAENU', 'LAENUMAKSE'], category: 'Kodulaen' },
        // Others
        { keywords: ['APTEEK', 'APOTHEKA', 'BENU', 'SÜDAMEAPTEEK'], category: 'Apteek' },
        { keywords: ['III SAMMAS', 'PENSIONISAMMAS'], category: 'III sammas' },
        { keywords: ['OMAD VAHELISED MAKSED', 'VAHELISED MAKSED'], category: 'Kanded oma kontode vahel' },
        { keywords: ['KINGITUS', 'LILLED'], category: 'Kingitused' },
        { keywords: ['LÄHETUS'], category: 'Lähetus' }
      ];

      for (const ruleGroup of staticEstonianRules) {
        const category = categories.find(
          (c) => c.name.toLowerCase() === ruleGroup.category.toLowerCase()
        );
        if (!category) continue;

        for (const kw of ruleGroup.keywords) {
          const uKw = kw.toUpperCase().trim();
          if (existingPatterns.has(uKw)) continue;

          newRulesToCreate.push({
            pattern: kw,
            conditions: [{ field: 'recipient', pattern: kw }],
            categoryId: category.id
          });
          existingPatterns.add(uKw);
        }
      }

      // 3. STAGE B: Dynamic transaction and text intelligence analysis
      // Group candidate frequencies of (cleaned word/phrase) -> categoryId
      const candidateCounts: Record<string, Record<string, number>> = {};
      const noiseWords = new Set([
        'oü', 'as', 'mtü', 'oy', 'ou', 'oe', 'aktsiaselts', 'osaühing', 'filiaal', 'peremarket', 'peremarketid', 
        'klubi', 'ee', 'eest', 'makse', 'kanne', 'ülekanne', 'sepa', 'sepa-makse', 'kaardimakse', 'sularaha', 
        'tehing', 'pank', 'swedbank', 'lhv', 'seb', 'coop', 'pank', 'kontole'
      ]);

      for (const t of transactions) {
        if (!t.categoryId) continue;

        // Skip if there's already a rule that matches this transaction
        const matchesExisting = applyRules(t, rules);
        if (matchesExisting) continue;

        // Use recipient if available index, otherwise description
        const textToUse = t.recipient?.trim() || t.description?.trim() || '';
        if (!textToUse) continue;

        // Clean common business suffixes and special characters
        const cleaned = textToUse
          .replace(/(?:oü|as|mtü|oy|ou|oe|aktsiaselts|osaühing|sa|ltd|gmbh|filiaal|peremarket|food|eesti)\.?$/gi, '')
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
          .trim();

        const words = cleaned.split(/\s+/).filter(w => w.length > 2 && isNaN(Number(w)));
        if (words.length === 0) continue;

        // Extract pattern: Check if first word is distinctive, or use multi-words
        const firstWord = words[0].toUpperCase();
        const firstTwoWords = words.length > 1 ? `${words[0]} ${words[1]}`.toUpperCase() : firstWord;

        const genericAvoid = new Set(['MAKSE', 'KANNE', 'ÜLEKANNE', 'KREEDIT', 'KAARDIMAKSE', 'SULARAHA', 'VIITENUMBER', 'ARVE', 'TEHING']);

        let patternToUse = "";
        if (!genericAvoid.has(firstWord) && firstWord.length >= 3) {
          patternToUse = words[0]; // Keep original cases for user appeal
        } else if (words.length > 1 && !genericAvoid.has(firstTwoWords)) {
          patternToUse = `${words[0]} ${words[1]}`;
        }

        if (patternToUse) {
          const capitalizedPattern = patternToUse.charAt(0).toUpperCase() + patternToUse.slice(1);
          if (!candidateCounts[capitalizedPattern]) {
            candidateCounts[capitalizedPattern] = {};
          }
          candidateCounts[capitalizedPattern][t.categoryId] = (candidateCounts[capitalizedPattern][t.categoryId] || 0) + 1;
        }
      }

      // Convert most prominent dynamic candidates to actual rules
      let dynamicCount = 0;
      for (const pattern of Object.keys(candidateCounts)) {
        const uPattern = pattern.toUpperCase().trim();
        if (existingPatterns.has(uPattern)) continue;

        const cats = candidateCounts[pattern];
        let maxCatId = "";
        let maxCount = 0;
        for (const [catId, count] of Object.entries(cats)) {
          if (count > maxCount) {
            maxCount = count;
            maxCatId = catId;
          }
        }

        if (maxCatId) {
          newRulesToCreate.push({
            pattern: pattern,
            conditions: [{ field: 'recipient', pattern: pattern }],
            categoryId: maxCatId
          });
          existingPatterns.add(uPattern);
          dynamicCount++;
        }
      }

      if (newRulesToCreate.length === 0) {
        toast.info("Kõik võimalikud automaatsed reeglid on juba loodud!");
        return;
      }

      await dbService.addRules(userId, newRulesToCreate);
      toast.success(
        `Edukalt salvestatud ${newRulesToCreate.length} uut reeglit! (millest ${dynamicCount} põhinevad kandeandmete analüüsil.)`,
        { duration: 8000 }
      );
      refresh();
    } catch (e: any) {
      console.error(e);
      toast.error("Automaatsete reeglite genereerimine ebaõnnestus.");
    } finally {
      setAutoGenerating(false);
    }
  };

  // New Category State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"income" | "expense" | "both">(
    "expense",
  );
  const [catParent, setCatParent] = useState<string | null>(null);

  const addCondition = () => {
    setRuleConditions([
      ...ruleConditions,
      { field: "description", pattern: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    if (ruleConditions.length > 1) {
      setRuleConditions(ruleConditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (
    index: number,
    field: keyof RuleCondition,
    value: string,
  ) => {
    const newConditions = [...ruleConditions];
    (newConditions[index] as any)[field] = value;
    setRuleConditions(newConditions);
  };

  const handleAddRule = async () => {
    const userId = auth.currentUser?.uid;
    const validConditions = ruleConditions
      .filter((c) => c.pattern.trim() !== "")
      .map((c) => ({ ...c, pattern: c.pattern.trim() }));

    if (!userId || validConditions.length === 0 || !newRuleCategory) {
      return toast.error("Täida vähemalt üks tingimus ja vali kategooria");
    }

    setSaving(true);
    try {
      await dbService.addRule(userId, {
        conditions: validConditions,
        categoryId: newRuleCategory,
      });
      setRuleConditions([{ field: "recipient", pattern: "" }]);
      setNewRuleCategory("");
      toast.success("Reegel lisatud");
      refresh();
    } catch (e: any) {
      toast.error("Viga: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !catName) return toast.error("Nimi on kohustuslik");

    setSaving(true);
    try {
      if (editingCatId) {
        await dbService.updateCategory(editingCatId, {
          name: catName,
          type: catType as any,
          parentId: catParent === "none" ? null : catParent,
        });
        toast.success("Kategooria muudetud");
      } else {
        await dbService.addCategory(userId, {
          name: catName,
          type: catType as any,
          isStarred: false,
          parentId: catParent === "none" ? null : catParent,
        });
        toast.success("Kategooria lisatud");
      }
      resetCatForm();
      refresh();
    } catch (e: any) {
      toast.error("Viga: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetCatForm = () => {
    setEditingCatId(null);
    setCatName("");
    setCatType("expense");
    setCatParent(null);
  };

  const handleEditCategory = (cat: any) => {
    setEditingCatId(cat.id);
    setCatName(cat.name);
    setCatType(cat.type);
    setCatParent(cat.parentId || "none");
    // Scroll to the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteCategory = async (id: string) => {
    // Note: window.confirm might be blocked in some iframe environments
    // For now we'll just execute it, or we could add a "Confirm" state
    try {
      await dbService.deleteCategory(id);
      toast.success("Kategooria kustutatud");
      refresh();
    } catch (e: any) {
      toast.error("Kustutamine ebaõnnestus");
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await dbService.deleteRule(id);
      toast.success("Reegel kustutatud");
    } catch (e: any) {
      toast.error("Reegli kustutamine ebaõnnestus");
    }
  };

  const handleToggleStar = async (cat: any) => {
    try {
      await dbService.updateCategory(cat.id, { isStarred: !cat.isStarred });
    } catch (e: any) {
      toast.error("Viga tärni muutmisel");
    }
  };

  const handleSetupRequestedCategories = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setSaving(true);
    try {
      // 1. Investeerimistulu
      let invParent = categories.find(
        (c) => c.name === "Investeerimistulu" && !c.parentId,
      );
      if (!invParent) {
        const docRef = await dbService.addCategory(userId, {
          name: "Investeerimistulu",
          type: "income",
          isStarred: false,
          parentId: null,
        });
        if (docRef)
          invParent = {
            id: docRef.id,
            name: "Investeerimistulu",
            type: "income",
            isStarred: false,
            parentId: null,
            userId,
          };
      }

      if (invParent) {
        const sub1 = categories.find(
          (c) => c.name === "Intressitulu" && c.parentId === invParent?.id,
        );
        if (!sub1)
          await dbService.addCategory(userId, {
            name: "Intressitulu",
            type: "income",
            isStarred: false,
            parentId: invParent.id,
          });

        const sub2 = categories.find(
          (c) => c.name === "Dividenditulu" && c.parentId === invParent?.id,
        );
        if (!sub2)
          await dbService.addCategory(userId, {
            name: "Dividenditulu",
            type: "income",
            isStarred: false,
            parentId: invParent.id,
          });
      }

      // 2. Toetused
      let toetParent = categories.find(
        (c) => c.name === "Toetused" && !c.parentId,
      );
      if (!toetParent) {
        const docRef = await dbService.addCategory(userId, {
          name: "Toetused",
          type: "income",
          isStarred: false,
          parentId: null,
        });
        if (docRef)
          toetParent = {
            id: docRef.id,
            name: "Toetused",
            type: "income",
            isStarred: false,
            parentId: null,
            userId,
          };
      }

      if (toetParent) {
        const subs = ["Peretoetus", "Puudetoetus", "Töötutoetus"];
        for (const s of subs) {
          const sub = categories.find(
            (c) => c.name === s && c.parentId === toetParent?.id,
          );
          if (!sub)
            await dbService.addCategory(userId, {
              name: s,
              type: "income",
              isStarred: false,
              parentId: toetParent.id,
            });
        }
      }

      toast.success("Kategooriad lisatud/kontrollitud");
      refresh();
    } catch (e: any) {
      toast.error("Viga seadistamisel");
    } finally {
      setSaving(false);
    }
  };

  const handleResetCategories = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const confirmReset = window.confirm(
      "Oled sa kindel, et soovid KÕIK kategooriad algseadistada? See kustutab kõik sinu praegused seadistatud kategooriad ja asendab need esialgsete vaikimisi kategooriatega!"
    );
    if (!confirmReset) return;

    setSaving(true);
    try {
      // 1. Delete all current categories for the user
      for (const cat of categories) {
        await dbService.deleteCategory(cat.id);
      }

      // 2. Add original categories with relationships
      const parentsOnly = DEFAULT_CATEGORIES.filter(cat => !(cat as any).parent);
      const parentIdMap: Record<string, string> = {};
      
      for (const cat of parentsOnly) {
        const docRef = await dbService.addCategory(userId, {
          name: cat.name,
          type: cat.type as any,
          isStarred: cat.isStarred || false,
          parentId: null
        });
        if (docRef?.id) {
          parentIdMap[cat.name] = docRef.id;
        }
      }
      
      const childrenOnly = DEFAULT_CATEGORIES.filter(cat => (cat as any).parent);
      await Promise.all(childrenOnly.map(cat => {
        const pName = (cat as any).parent;
        const parentId = pName ? (parentIdMap[pName] || null) : null;
        return dbService.addCategory(userId, {
          name: cat.name,
          type: cat.type as any,
          isStarred: cat.isStarred || false,
          parentId
        });
      }));

      toast.success("Kategooriad on algseadistatud ja vaikimisi kategooriad taastatud!");
      refresh();
    } catch (e: any) {
      console.error(e);
      toast.error("Kategooriate taastamine ebaõnnestus");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <h2 className="text-lg font-bold tracking-tight">Süsteemi seaded</h2>
      </header>

      <div className="flex-1 p-6 overflow-auto bg-slate-50">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          <section>
            <div className="flex justify-between items-center mb-4">
              <div 
                className="flex items-center gap-2 cursor-pointer select-none group"
                onClick={() => setRulesCollapsed(!rulesCollapsed)}
              >
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                  Automaatse kategoriseerimise reeglid
                </h2>
                {rulesCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-950 font-bold gap-2"
                  onClick={handleRecategorizeAll}
                  disabled={recategorizing || loading}
                >
                  {recategorizing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  KATEGORISEERI KÕIK
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] border-blue-300 text-blue-900 bg-blue-50 hover:bg-blue-100 hover:text-blue-950 font-bold gap-2"
                  onClick={handleAutoGenerateRules}
                  disabled={autoGenerating}
                >
                  {autoGenerating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  GENEREERI REEGLID
                </Button>
              </div>
            </div>
            {!rulesCollapsed && (
              <div className="bg-white rounded border border-slate-200 p-4 shadow-sm animate-in fade-in duration-200">
              <div className="space-y-4 mb-6">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Uus reegel
                </div>

                <div className="space-y-3">
                  {ruleConditions.map((condition, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-24 shrink-0">
                        <Select
                          value={condition.field}
                          onValueChange={(v: RuleField) =>
                            updateCondition(idx, "field", v)
                          }
                        >
                          <SelectTrigger className="h-8 text-[11px] border-slate-200 bg-slate-50">
                            <SelectValue>
                              {condition.field === "recipient"
                                ? "Saaja nimi"
                                : "Selgitus"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem
                              value="recipient"
                              className="text-[11px]"
                            >
                              Saaja nimi
                            </SelectItem>
                            <SelectItem
                              value="description"
                              className="text-[11px]"
                            >
                              Selgitus
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-medium">
                          sisaldab
                        </span>
                        <Input
                          placeholder="muster..."
                          className="h-8 text-[11px] border-slate-200 bg-slate-50"
                          value={condition.pattern}
                          onChange={(e) =>
                            updateCondition(idx, "pattern", e.target.value)
                          }
                        />
                      </div>

                      {ruleConditions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-300 hover:text-rose-500"
                          onClick={() => removeCondition(idx)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 pt-2 border-t border-slate-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addCondition}
                    className="h-8 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    LISA TINGIMUS (JA)
                  </Button>

                  <div className="flex-1 flex items-center gap-2 justify-end">
                    <Label className="text-[10px] uppercase text-slate-400 font-bold whitespace-nowrap">
                      Määra kategooria:
                    </Label>
                    <Select
                      value={newRuleCategory}
                      onValueChange={setNewRuleCategory}
                    >
                      <SelectTrigger className="h-8 w-48 text-[11px] border-slate-200 bg-slate-50">
                        <SelectValue placeholder="Vali...">
                          {newRuleCategory &&
                          categories.find((c) => c.id === newRuleCategory)
                            ? (() => {
                                const cat = categories.find(
                                  (c) => c.id === newRuleCategory,
                                )!;
                                const parent = cat.parentId
                                  ? categories.find(
                                      (p) => p.id === cat.parentId,
                                    )
                                  : null;
                                return parent
                                  ? `${parent.name} > ${cat.name}`
                                  : cat.name;
                              })()
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-slate-50 border-slate-200 shadow-xl">
                        {categories
                          .sort((a, b) => {
                            const aParent = a.parentId
                              ? categories.find((c) => c.id === a.parentId)
                                  ?.name || ""
                              : a.name;
                            const bParent = b.parentId
                              ? categories.find((c) => c.id === b.parentId)
                                  ?.name || ""
                              : b.name;
                            return (
                              aParent.localeCompare(bParent) ||
                              a.name.localeCompare(b.name)
                            );
                          })
                          .map((cat) => {
                            const parent = cat.parentId
                              ? categories.find((c) => c.id === cat.parentId)
                              : null;
                            const label = parent
                              ? `${parent.name} > ${cat.name}`
                              : cat.name;
                            return (
                              <SelectItem
                                key={cat.id}
                                value={cat.id}
                                className="text-[11px]"
                              >
                                {label}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={handleAddRule}
                      disabled={saving}
                      size="sm"
                      variant="outline"
                      className="h-8 text-[10px] border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 font-bold ml-2"
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                      ) : (
                        <Check className="w-3 h-3 mr-2 text-emerald-500" />
                      )}
                      Salvesta reegel
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {sortedRules.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">
                    Reegleid veel pole.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-50 border-t border-slate-100">
                    {sortedRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="py-2 flex justify-between items-center text-[10px]"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600">
                          <span className="font-medium">Kui</span>
                          {rule.conditions && rule.conditions.length > 0 ? (
                            rule.conditions.map((c, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && (
                                  <span className="font-bold text-slate-400">
                                    JA
                                  </span>
                                )}
                                <span className="text-slate-400 italic">
                                  {c.field === "recipient"
                                    ? "saaja"
                                    : "selgitus"}
                                </span>
                                <span className="font-bold text-blue-600 border border-blue-100 bg-blue-50 px-1 rounded">
                                  "{c.pattern}"
                                </span>
                              </React.Fragment>
                            ))
                          ) : (
                            <>
                              <span className="text-slate-400 italic">
                                sisaldab
                              </span>
                              <span className="font-bold text-blue-600 border border-blue-100 bg-blue-50 px-1 rounded">
                                "{rule.pattern}"
                              </span>
                            </>
                          )}
                          <span className="font-medium">, siis</span>
                          <span className="font-bold text-slate-900 border border-slate-200 bg-slate-50 px-1 rounded">
                            {(() => {
                              const cat = categories.find(
                                (c) => c.id === rule.categoryId,
                              );
                              if (!cat) return "Tundmatu";
                              const parent = cat.parentId
                                ? categories.find((p) => p.id === cat.parentId)
                                : null;
                              return parent
                                ? `${parent.name} > ${cat.name}`
                                : cat.name;
                            })()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-200 hover:text-rose-500"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Halda kategooriaid
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-bold"
                onClick={handleResetCategories}
                disabled={saving}
              >
                Algseadista kategooriad
              </Button>
            </div>

            {/* Add/Edit Category Form */}
            <div className="bg-white rounded border border-slate-200 p-4 shadow-sm mb-6">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-3">
                {editingCatId ? "Muuda kategooriat" : "Lisa uus kategooria"}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-[9px] uppercase text-slate-400 font-bold">
                    Nimi
                  </Label>
                  <Input
                    placeholder="Kategooria nimi"
                    className="h-8 text-[11px] border-slate-200 bg-slate-50"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase text-slate-400 font-bold">
                    Tüüp
                  </Label>
                  <Select
                    value={catType}
                    onValueChange={(v: any) => setCatType(v)}
                  >
                    <SelectTrigger className="h-8 text-[11px] border-slate-200 bg-slate-50">
                      <SelectValue>
                        {catType === "expense"
                          ? "Kulu"
                          : catType === "income"
                            ? "Tulu"
                            : catType === "both"
                              ? "Mõlemad"
                              : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-50 border-slate-200 shadow-xl">
                      <SelectItem value="expense" className="text-[11px]">
                        Kulu
                      </SelectItem>
                      <SelectItem value="income" className="text-[11px]">
                        Tulu
                      </SelectItem>
                      <SelectItem value="both" className="text-[11px]">
                        Mõlemad
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] uppercase text-slate-400 font-bold">
                    Ülemkategooria
                  </Label>
                  <Select
                    value={catParent || "none"}
                    onValueChange={setCatParent}
                  >
                    <SelectTrigger className="h-8 text-[11px] border-slate-200 bg-slate-50">
                      <SelectValue placeholder="Puudub">
                        {catParent && catParent !== "none"
                          ? categories.find((c) => c.id === catParent)?.name
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-50 border-slate-200 shadow-xl">
                      <SelectItem value="none" className="text-[11px]">
                        Puudub (Ülem)
                      </SelectItem>
                      {categories
                        .filter((c) => !c.parentId && c.id !== editingCatId)
                        .map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            className="text-[11px]"
                          >
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveCategory}
                    disabled={saving}
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 text-[10px] border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 font-bold"
                  >
                    {saving ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    ) : editingCatId ? (
                      <Check className="w-3 h-3 mr-2 text-emerald-500" />
                    ) : (
                      <Plus className="w-3 h-3 mr-2 text-slate-400" />
                    )}
                    {editingCatId ? "Salvesta" : "Lisa"}
                  </Button>
                  {editingCatId && (
                    <Button
                      onClick={resetCatForm}
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px] border-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* List Top Level Categories */}
              {sortedTopLevelCategories.map((cat) => {
                const subcats = categories
                  .filter((sub) => sub.parentId === cat.id)
                  .sort((a, b) => a.name.localeCompare(b.name, "et"));
                const hasSubcats = subcats.length > 0;

                return (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-white rounded border border-slate-200 shadow-sm transition-hover hover:border-slate-300">
                      <div className="flex items-center gap-3">
                        {hasSubcats ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                            onClick={() => toggleCategoryExpand(cat.id)}
                            title={expandedCatIds[cat.id] ? "Peida alamkategooriat" : "Näita alamkategooriaid"}
                          >
                            <ChevronRight
                              className={cn(
                                "w-4 h-4 transition-transform duration-200",
                                expandedCatIds[cat.id] && "rotate-90"
                              )}
                            />
                          </Button>
                        ) : (
                          <div className="w-6 shrink-0" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => handleToggleStar(cat)}
                        >
                          <Star
                            className={cn(
                              "w-3.5 h-3.5 transition-colors",
                              cat.isStarred
                                ? "text-amber-400 fill-amber-400"
                                : "text-slate-200 hover:text-slate-300",
                            )}
                          />
                        </Button>
                        <span 
                          className={cn(
                            "font-bold text-[12px] text-slate-800 tracking-tight select-none",
                            hasSubcats ? "cursor-pointer hover:text-blue-700 transition-colors" : ""
                          )}
                          onClick={() => {
                            if (hasSubcats) toggleCategoryExpand(cat.id);
                          }}
                        >
                          {cat.name}
                        </span>
                        <span
                          className={cn(
                            "text-[8px] uppercase font-bold px-1.5 py-0.5 rounded border leading-none shrink-0",
                            cat.type === "income"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : cat.type === "expense"
                                ? "bg-rose-50 text-rose-700 border-rose-100"
                                : "bg-slate-50 text-slate-700 border-slate-100",
                          )}
                        >
                          {cat.type === "income"
                            ? "Tulu"
                            : cat.type === "expense"
                              ? "Kulu"
                              : "Mõlemad"}
                        </span>
                        {cat.isStarred && (
                          <span className="text-[8px] text-amber-500 font-bold uppercase shrink-0">
                            Ignoreeritud
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleEditCategory(cat)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Subcategories */}
                    {expandedCatIds[cat.id] && hasSubcats && (
                      <div className="pl-8 space-y-2 border-l border-slate-200 ml-6 animate-in fade-in slide-in-from-top-1 duration-200">
                        {subcats.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex justify-between items-center p-2 bg-slate-50/50 rounded border border-slate-100 group transition-hover hover:bg-white hover:border-slate-200"
                          >
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 p-0"
                                onClick={() => handleToggleStar(sub)}
                              >
                                <Star
                                  className={cn(
                                    "w-3 h-3 transition-colors",
                                    sub.isStarred
                                      ? "text-amber-400 fill-amber-400"
                                      : "text-slate-200 hover:text-slate-300",
                                  )}
                                />
                              </Button>
                              <span className="text-[11px] text-slate-600 font-medium">
                                {sub.name}
                              </span>
                              {sub.isStarred && (
                                <span className="text-[7px] text-amber-500 font-bold uppercase">
                                  Ignoreeritud
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleEditCategory(sub)}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => handleDeleteCategory(sub.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pt-8 border-t border-slate-200">
            <div className="bg-rose-50 rounded border border-rose-100 p-6 shadow-sm">
              <h3 className="text-rose-900 font-bold text-sm mb-2">Ohtlik ala</h3>
              <p className="text-rose-700 text-xs mb-4 leading-relaxed">
                Kõikide andmete kustutamine eemaldab jäädavalt kõik sinu tehingud, seadistatud kategooriad ja loodud reeglid. Seda tegevust ei saa tagasi võtta.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="h-9 text-[11px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700"
                onClick={handleClearAllData}
                disabled={clearing}
              >
                {clearing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Tühjenda kõik andmed
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
