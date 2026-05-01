import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/api/dialog";
import { downloadDir, join } from "@tauri-apps/api/path";

function App() {
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:30");
  const [savePath, setSavePath] = useState("");
  const [logs, setLogs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fullVideo, setFullVideo] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  
  // Settings & History UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Download options
  const [videoQuality, setVideoQuality] = useState("Best");
  const [format, setFormat] = useState("mp4");

  // History state
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("ytHistory");
    return saved ? JSON.parse(saved) : [];
  });

  const logEndRef = useRef(null);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  useEffect(() => {
    const unlisten = listen("download-log", (event) => {
      setLogs((prev) => [...prev, event.payload]);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Save history to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem("ytHistory", JSON.stringify(history));
  }, [history]);

  // Initialize savePath to Downloads folder
  useEffect(() => {
    const initPath = async () => {
      try {
        const dir = await downloadDir();
        const fullPath = await join(dir, `clip.${format}`);
        setSavePath(fullPath);
      } catch (err) {
        console.error("Failed to get download dir:", err);
      }
    };
    initPath();
  }, []); // Only run once on mount

  // Fetch video info when url changes
  useEffect(() => {
    if (!url || !url.startsWith("http")) return;
    
    const timeoutId = setTimeout(async () => {
      try {
        setLogs(prev => [...prev, { message: "Fetching video info...", level: "info" }]);
        const info = await invoke("get_video_info", { url });
        setEndTime(formatTime(info.duration));
        setVideoTitle(info.title);
        setLogs(prev => [...prev, { message: `Found: ${info.title} (${formatTime(info.duration)})`, level: "success" }]);
        
        // Clean title for filesystem
        const safeTitle = info.title.replace(/[\\/:*?"<>|]/g, '-').trim();
        try {
          const dir = await downloadDir();
          const fullPath = await join(dir, `${safeTitle || 'clip'}.${format}`);
          setSavePath(fullPath);
        } catch (err) {
          console.error("Failed to update download dir with title:", err);
        }
      } catch (err) {
        setLogs(prev => [...prev, { message: `Could not fetch info: ${err}`, level: "error" }]);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timeoutId);
  }, [url, format]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSelectPath = async () => {
    try {
      const selected = await save({
        filters: [{ name: "Media", extensions: [format] }],
        defaultPath: savePath || `clip.${format}`,
      });
      if (selected) {
        setSavePath(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startDownload = async () => {
    if (!url || !savePath) {
      alert("Please provide a URL and select a save location in settings.");
      return;
    }

    setLogs([]);
    setIsDownloading(true);

    try {
      await invoke("download_video", {
        args: {
          url,
          start_time: startTime,
          end_time: endTime,
          save_path: savePath,
          full_video: fullVideo,
          video_quality: videoQuality,
          format: format,
        },
      });
      
      // On success, save to history
      setHistory(prev => [{
        url,
        title: videoTitle || "Unknown Video",
        time: fullVideo ? "Full Video" : `${startTime} - ${endTime}`,
        format,
        date: new Date().toLocaleString(),
        path: savePath
      }, ...prev]);
      
    } catch (err) {
      setLogs((prev) => [...prev, { message: `Error: ${err}`, level: "error" }]);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>YouTube Clipper</h1>
          <p>Download and cut videos with precision.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`icon-btn ${showHistory ? 'active' : ''}`}
            onClick={() => { setShowHistory(!showHistory); setShowSettings(false); }}
            title="History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
          <button 
            className={`icon-btn ${showSettings ? 'active' : ''}`}
            onClick={() => { setShowSettings(!showSettings); setShowHistory(false); }}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
            </svg>
          </button>
        </div>
      </header>

      {showHistory && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Download History</h3>
            {history.length > 0 && (
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to clear your download history?")) {
                    setHistory([]);
                  }
                }}
                style={{ background: 'transparent', color: 'var(--error-color)', fontSize: '0.8rem', padding: '0' }}
              >
                Clear All
              </button>
            )}
          </div>
          
          {history.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--info-color)', textAlign: 'center', padding: '1rem 0' }}>No downloads yet.</p>
          ) : (
            <div className="history-list">
              {history.map((item, idx) => (
                <div key={idx} className="history-item">
                  <div className="history-item-header">
                    <strong title={item.title}>{item.title}</strong>
                    <span className="history-date">{item.date}</span>
                  </div>
                  <div className="history-item-details">
                    <span>{item.time}</span> • <span>{item.format.toUpperCase()}</span>
                  </div>
                  <div className="history-path" title={item.path}>{item.path}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <div className="panel">
          <h3>Settings</h3>
          <div className="row" style={{ marginBottom: '1rem' }}>
            <div className="input-group">
              <label>Video Quality</label>
              <select 
                value={videoQuality} 
                onChange={(e) => setVideoQuality(e.target.value)}
                disabled={format === 'mp3' || format === 'm4a'}
              >
                <option value="Best">Best</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>
            <div className="input-group">
              <label>Format</label>
              <select 
                value={format} 
                onChange={(e) => {
                  setFormat(e.target.value);
                  // Update save path extension if one exists
                  if (savePath) {
                    const newPath = savePath.replace(/\.[^/.]+$/, `.${e.target.value}`);
                    setSavePath(newPath);
                  }
                }}
              >
                <option value="mp4">MP4 (Video)</option>
                <option value="mkv">MKV (Video)</option>
                <option value="mp3">MP3 (Audio Only)</option>
                <option value="m4a">M4A (Audio Only)</option>
              </select>
            </div>
          </div>
          
          <div className="input-group">
            <label>Save To</label>
            <div className="path-selector">
              <input type="text" readOnly value={savePath} placeholder="Select path..." />
              <button onClick={handleSelectPath}>Browse</button>
            </div>
          </div>
        </div>
      )}

      <div className="input-group">
        <label>YouTube URL</label>
        <input
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={fullVideo}
            onChange={(e) => setFullVideo(e.target.checked)}
          />
          Download Entire Video (No Clipping)
        </label>
      </div>

      <div className={`row ${fullVideo ? 'disabled-row' : ''}`} style={{ opacity: fullVideo ? 0.5 : 1, pointerEvents: fullVideo ? 'none' : 'auto' }}>
        <div className="input-group">
          <label>Start Time</label>
          <input
            type="text"
            placeholder="00:00:00"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={fullVideo}
          />
        </div>
        <div className="input-group">
          <label>End Time</label>
          <input
            type="text"
            placeholder="00:00:30"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={fullVideo}
          />
        </div>
      </div>

      <button
        className={`download-btn ${isDownloading ? "loading" : ""}`}
        disabled={isDownloading}
        onClick={startDownload}
      >
        {isDownloading ? "Processing..." : "Download & Cut Clip"}
      </button>

      <div className="terminal">
        <div className="terminal-header">Logs</div>
        <div className="terminal-content">
          {logs.map((log, i) => (
            <div key={i} className={`log-line ${log.level}`}>
              <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>{" "}
              {log.message}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
      
      <div className="footer">
        Created by radikonreturn • <a href="https://github.com/radikonreturn" target="_blank" rel="noreferrer">GitHub</a> • <a href="https://x.com/radikonreturn" target="_blank" rel="noreferrer">X</a>
      </div>
    </div>
  );
}

export default App;
