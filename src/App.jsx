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
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [videoQuality, setVideoQuality] = useState("Best");
  const [format, setFormat] = useState("mp4");

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
        <button 
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          ⚙️
        </button>
      </header>

      {showSettings && (
        <div className="settings-panel">
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
    </div>
  );
}

export default App;
