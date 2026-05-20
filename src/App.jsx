import { useState, useMemo } from 'react';
import { Upload, ShieldCheck, AlertCircle, Info, BookOpen, Calculator } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker' or 'tutorial'
  const [allTimestamps, setAllTimestamps] = useState([]);
  const [eventPackTimes, setEventPackTimes] = useState(new Map());
  const [eventBreakdown, setEventBreakdown] = useState([]);
  const [excludeEventPacks, setExcludeEventPacks] = useState(false);
  const [mythicEvents, setMythicEvents] = useState([]);
  const [selectedMythicTime, setSelectedMythicTime] = useState(null);

  const [hasHeirloom, setHasHeirloom] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setAllTimestamps([]);
    setEventPackTimes(new Map());
    setEventBreakdown([]);
    setMythicEvents([]);
    setSelectedMythicTime(null);
    setManualDate("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        let items = [];
        if (data && Array.isArray(data.userData)) {
          data.userData.forEach(ud => {
            if (Array.isArray(ud.subscribers)) {
              ud.subscribers.forEach(sub => {
                if (sub.userData && Array.isArray(sub.userData.currentInventoryItems)) {
                  items = items.concat(sub.userData.currentInventoryItems);
                }
              });
            }
          });
        }

        if (items.length === 0) {
          throw new Error("Invalid JSON structure. Ensure this is the correct EA Data Export.");
        }

        const packTimes = new Set();
        const eventPacksMap = new Map();
        const mythicsMap = new Map(); 

        items.forEach(item => {
          // 1. Extract Pack Openings
          let isPack = false;
          let dateGranted = null;
          let eventName = null;

          (item.details || []).forEach(d => {
            if (d.key === 'acquisitionType' && (d.value === 'packs_open' || d.value === 'pack_open')) {
              isPack = true;
            }
            if (d.key === 'dateGranted') {
              // Fix Safari/cross-browser date parsing bugs
              dateGranted = d.value.replace(" UTC", "");
            }
            if (d.key === 'Theme') {
              eventName = d.value;
            }
          });

          if (isPack && dateGranted) {
            const time = new Date(dateGranted).getTime();
            if (!isNaN(time)) {
              packTimes.add(time);
              if (eventName) {
                eventPacksMap.set(time, eventName);
              }
            }
          }

          // 2. Identify Base Mythics & Ignore Exotic Shard Variations
          const category = (item.category || '').toUpperCase();
          const topLevelRarity = item.levelRatingRarityRank || '';
          const name = (item.name || '').toLowerCase();
          
          let hasIsHeirloomFlag = false;
          let isUniversalMelee = false;
          let hasMythicRarityTag = false;

          (item.details || []).forEach(d => {
             if (d.key === 'isHeirloom' && d.value === 'true') hasIsHeirloomFlag = true;
             if (d.key === 'Type' && d.value === 'UniversalMelee') isUniversalMelee = true;
             if (d.key === 'Rarity' && d.value === 'Mythic') hasMythicRarityTag = true;
          });

          const isMythic = category === 'MYTHICS' || 
                           topLevelRarity === 'Heirloom' || 
                           name.includes('heirloom') || 
                           hasIsHeirloomFlag || 
                           isUniversalMelee || 
                           hasMythicRarityTag;

          // Filter out obvious sub-components and exotic shard upgrades so the dropdown isn't cluttered
          const isExoticOrSubComponent = name.includes('theme') ||
            name.includes('powersource') ||
            name.includes('emission') ||
            name.includes('quip') ||
            name.includes('pose') ||
            name.includes('frame') ||
            name.includes('rt0');

          if (isMythic && !isExoticOrSubComponent && dateGranted) {
            const time = new Date(dateGranted).getTime();
            if (!isNaN(time)) {
              if (!mythicsMap.has(time)) {
                mythicsMap.set(time, {
                  date: time,
                  name: item.name.replace(/_/g, ' ').toUpperCase(),
                  dateString: new Date(dateGranted).toLocaleDateString()
                });
              }
            }
          }
        });

        const sortedPacks = Array.from(packTimes).sort((a, b) => a - b);
        const sortedMythics = Array.from(mythicsMap.values()).sort((a, b) => b.date - a.date);

        const breakdownMap = {};
        eventPacksMap.forEach(theme => {
          breakdownMap[theme] = (breakdownMap[theme] || 0) + 1;
        });
        const sortedBreakdown = Object.entries(breakdownMap)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));

        setAllTimestamps(sortedPacks);
        setEventPackTimes(eventPacksMap);
        setEventBreakdown(sortedBreakdown);
        setMythicEvents(sortedMythics);

        if (sortedMythics.length > 0) {
          setHasHeirloom(true);
          setSelectedMythicTime(sortedMythics[0].date); // Default to most recent
        } else {
          setHasHeirloom(false);
        }

      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };
    reader.readAsText(file);
  };

  // Calculate dynamic packs based on user selections
  const { packCount, validPacks } = useMemo(() => {
    let activeResetTime = null;

    if (hasHeirloom) {
      if (manualDate) {
        const manualTime = new Date(manualDate).getTime();
        if (!isNaN(manualTime)) activeResetTime = manualTime;
      } else if (selectedMythicTime) {
        activeResetTime = selectedMythicTime;
      }
    }

    const baseTimestamps = excludeEventPacks 
      ? allTimestamps.filter(t => !eventPackTimes.has(t)) 
      : allTimestamps;

    const filtered = activeResetTime ? baseTimestamps.filter(t => t > activeResetTime) : baseTimestamps;
    return { packCount: filtered.length, validPacks: filtered };
  }, [allTimestamps, eventPackTimes, hasHeirloom, manualDate, selectedMythicTime, excludeEventPacks]);

  const progress = Math.min((packCount / 500) * 100, 100);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-red-500/30">
      <div className="max-w-2xl w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-full mb-2">
            <ShieldCheck className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">Apex Pity Tracker</h1>
          <p className="text-neutral-400 text-sm max-w-md mx-auto leading-relaxed">
            Upload your EA Data Export. Processed 100% locally in your browser. No data ever leaves your device.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1 mx-auto max-w-sm">
          <button 
            onClick={() => setCurrentView('tracker')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${currentView === 'tracker' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <Calculator className="w-4 h-4" />
            Tracker
          </button>
          <button 
            onClick={() => setCurrentView('tutorial')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${currentView === 'tutorial' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <BookOpen className="w-4 h-4" />
            How to use
          </button>
        </div>

        {currentView === 'tracker' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Upload Zone */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-8 flex flex-col items-center justify-center border-dashed hover:border-red-500/50 transition-colors">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-neutral-500 mb-4 group-hover:text-red-400 transition-colors" />
                <p className="text-lg font-medium text-neutral-300">
                  {fileName ? fileName : "Drop your JSON file here"}
                </p>
                <p className="text-xs text-neutral-600 mt-2">or click to browse</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-900/50 rounded-xl p-4 flex items-start gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Results Area */}
            {allTimestamps.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Heirloom Selector Configuration */}
                <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={hasHeirloom}
                        onChange={(e) => setHasHeirloom(e.target.checked)}
                        className="w-5 h-5 appearance-none rounded border border-neutral-700 bg-neutral-950 checked:bg-red-500 checked:border-red-500 transition-colors peer"
                      />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 peer-checked:opacity-100">
                        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="none">
                          <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
                        </svg>
                      </div>
                    </div>
                    <span className="font-medium text-neutral-200 group-hover:text-white transition-colors">
                      I have pulled Heirloom Shards before
                    </span>
                  </label>

                  {hasHeirloom && (
                    <div className="pl-8 space-y-4 pt-2 border-l-2 border-neutral-800 ml-2.5 mt-2">

                      {mythicEvents.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-xs text-neutral-400 mb-2">
                            <Info className="w-4 h-4 shrink-0 text-blue-400" />
                            <p>We detected Mythics in your account. Select the base item you bought with <b>Heirloom Shards</b>. (Collection Events and Exotic Shard variations do not reset pity).</p>
                          </div>
                          <select
                            className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg p-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none"
                            value={selectedMythicTime || ""}
                            onChange={(e) => {
                              setSelectedMythicTime(Number(e.target.value));
                              setManualDate(""); // clear manual override if they use the dropdown
                            }}
                          >
                            {mythicEvents.map(event => (
                              <option key={event.date} value={event.date}>
                                {event.dateString} — {event.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Or enter date manually (Unspent Shards)</p>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => {
                            setManualDate(e.target.value);
                            setSelectedMythicTime(null);
                          }}
                          className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg p-3 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <hr className="border-neutral-800/50 my-4" />
                  
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={excludeEventPacks}
                        onChange={(e) => setExcludeEventPacks(e.target.checked)}
                        className="w-5 h-5 appearance-none rounded border border-neutral-700 bg-neutral-950 checked:bg-blue-500 checked:border-blue-500 transition-colors peer"
                      />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 peer-checked:opacity-100">
                        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="none">
                          <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-neutral-200 group-hover:text-white transition-colors block">
                        Exclude Collection Event Packs (Experimental)
                      </span>
                      <span className="text-xs text-neutral-500 block">
                        May inadvertently remove standard packs that contained thematic items.
                      </span>
                    </div>
                  </label>
                </div>

                {/* Dashboard Display */}
                <div className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"></div>

                  <p className="text-sm text-neutral-500 uppercase tracking-widest font-semibold mb-2">Packs Opened</p>

                  <div className="flex items-baseline justify-center gap-2 mb-8">
                    <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500">
                      {packCount}
                    </span>
                    <span className="text-2xl text-neutral-600 font-bold">/ 500</span>
                  </div>

                  <div className="w-full h-4 bg-neutral-950 rounded-full border border-neutral-800 overflow-hidden relative mb-3">
                    <div
                      className="bg-gradient-to-r from-red-600 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>

                  <p className="text-sm font-medium text-neutral-400">
                    {500 - packCount > 0
                      ? <span className="text-orange-400">{500 - packCount} packs remaining</span>
                      : <span className="text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">You have reached the 500 pack limit! Shards guaranteed.</span>}
                  </p>

                  <div className="mt-8 pt-6 border-t border-neutral-800/50 flex flex-col items-center gap-4">
                    <div className="bg-neutral-950/50 rounded-xl px-6 py-3 border border-neutral-800/30">
                      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Lifetime Total</p>
                      <p className="text-xl font-bold text-neutral-300">{allTimestamps.length}</p>
                    </div>

                    {!excludeEventPacks && (
                      <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 text-left max-w-lg mt-2">
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          <strong className="text-red-400 font-semibold uppercase tracking-wider">Note:</strong> EA's data groups Collection Event Packs and Standard Packs together. If you have purchased 24-pack Collection Events in the past, those packs are currently inflating this total. Use the toggle above to filter them out, or manually subtract them.
                        </p>
                      </div>
                    )}

                    {excludeEventPacks && eventBreakdown.length > 0 && (
                      <div className="w-full mt-2">
                        <details className="text-left group/details w-full">
                          <summary className="cursor-pointer text-xs font-semibold text-neutral-500 hover:text-neutral-300 transition-colors list-none flex items-center justify-center gap-1 uppercase tracking-widest bg-neutral-950/50 border border-neutral-800/50 rounded-xl py-2 px-4 mx-auto max-w-xs">
                            <span className="group-open/details:hidden">View Excluded Event Packs ({eventPackTimes.size})</span>
                            <span className="hidden group-open/details:block">Hide Excluded Event Packs</span>
                            <svg className="w-3 h-3 transition-transform group-open/details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </summary>
                          <div className="mt-4 bg-neutral-950/50 border border-neutral-800/50 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-xs text-left text-neutral-400">
                              <thead className="text-neutral-500 uppercase font-semibold border-b border-neutral-800/50">
                                <tr>
                                  <th className="pb-2">Theme ID</th>
                                  <th className="pb-2 text-right">Packs</th>
                                </tr>
                              </thead>
                              <tbody>
                                {eventBreakdown.map(ev => (
                                  <tr key={ev.name} className="border-b border-neutral-800/30 last:border-0 hover:bg-neutral-900/50">
                                    <td className="py-2 font-mono text-neutral-300">{ev.name}</td>
                                    <td className="py-2 text-right font-bold text-blue-400">{ev.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {currentView === 'tutorial' && (
          <Tutorial />
        )}

      </div>
    </div>
  );
}

function Tutorial() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">How to get your EA Data</h2>
        
        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-800 before:to-transparent">
          
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-neutral-950 bg-neutral-800 text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10">1</div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-neutral-950/50 p-5 rounded-xl border border-neutral-800/50 hover:border-red-500/30 transition-colors">
              <h3 className="font-bold text-white mb-2">Login to EA Account</h3>
              <p className="text-sm text-neutral-400">Go to the official EA website and login to your account. Navigate to <span className="text-neutral-200 font-medium">Account Settings &gt; EA Data Privacy</span>.</p>
            </div>
          </div>

          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-neutral-950 bg-neutral-800 text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10">2</div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-neutral-950/50 p-5 rounded-xl border border-neutral-800/50 hover:border-red-500/30 transition-colors">
              <h3 className="font-bold text-white mb-2">Request a Download</h3>
              <p className="text-sm text-neutral-400">Scroll down and click on <span className="text-neutral-200 font-medium">Request a Download</span>. Select "Apex Legends" and submit your request. EA is legally required to provide this data.</p>
            </div>
          </div>

          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-neutral-950 bg-neutral-800 text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10">3</div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-neutral-950/50 p-5 rounded-xl border border-neutral-800/50 hover:border-red-500/30 transition-colors">
              <h3 className="font-bold text-white mb-2">Wait for Email</h3>
              <p className="text-sm text-neutral-400">EA will process your request. This typically takes a few hours, but can sometimes take up to several days depending on their queue.</p>
            </div>
          </div>

          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-neutral-950 bg-red-600 text-white font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_15px_rgba(220,38,38,0.5)] z-10">4</div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-neutral-950/50 p-5 rounded-xl border border-red-900/30 hover:border-red-500/50 transition-colors">
              <h3 className="font-bold text-white mb-2">Upload the JSON</h3>
              <p className="text-sm text-neutral-400">Once you receive the download link, extract the ZIP file. Look for the file named <code className="bg-neutral-900 px-1 py-0.5 rounded text-red-300 border border-neutral-800 font-mono text-xs">Request-[ID]-ApexLegends.json</code> and upload it to this tracker.</p>
            </div>
          </div>

        </div>
      </div>
      
      <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-red-500" />
          Frequently Asked Questions
        </h3>
        <div className="space-y-5">
          <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <h4 className="font-semibold text-neutral-200">Is my data safe?</h4>
            <p className="text-sm text-neutral-400 mt-2">Yes. This application runs entirely in your browser. The file is never uploaded to any server or backend. You can even disconnect from the internet before uploading your file, and it will still work perfectly.</p>
          </div>
          <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <h4 className="font-semibold text-neutral-200">Why does it need my EA Data?</h4>
            <p className="text-sm text-neutral-400 mt-2">Apex Legends does not provide a public API for checking pack history. The only accurate way to determine exactly how many packs you've opened is by parsing the official transaction logs from EA's GDPR data export.</p>
          </div>
          <div className="bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <h4 className="font-semibold text-neutral-200">Are collection event packs counted?</h4>
            <p className="text-sm text-neutral-400 mt-2">Yes, all standard, epic, legendary, and collection event packs are counted. However, buying an heirloom directly through a collection event does not reset your 500-pack pity timer.</p>
          </div>
        </div>
      </div>
    </div>
  );
}