import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/api/dialog";

function App() {
  const [url, setUrl] = useState("");
  const [startTime, setStartTime] = useState("00:00:00");
  const [endTime, setEndTime] = useState("00:00:30");
  const [savePath, setSavePath] = useState("");
  const [logs, setLogs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    const unlisten = listen("download-log", (event) => {
      setLogs((prev) => [...prev, event.payload]);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSelectPath = async () => {
    try {
      const selected = await save({
        filters: [{ name: "Video", extensions: ["mp4"] }],
        defaultPath: "clip.mp4",
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
      alert("Please provide a URL and select a save location.");
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
      <header>
        <h1>YouTube Clipper</h1>
        <p>Download and cut videos with precision.</p>
      </header>

      <div className="input-group">
        <label>YouTube URL</label>
        <input
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="row">
        <div className="input-group">
          <label>Start Time</label>
          <input
            type="text"
            placeholder="00:00:00"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>End Time</label>
          <input
            type="text"
            placeholder="00:00:30"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div className="input-group">
        <label>Save To</label>
        <div className="path-selector">
          <input type="text" readOnly value={savePath} placeholder="Select path..." />
          <button onClick={handleSelectPath}>Browse</button>
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
