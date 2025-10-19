import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ChatRoom from "./pages/ChatRoom";

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat/:roomCode" element={<ChatRoom />} />
      </Routes>
    </div>
  );
}
