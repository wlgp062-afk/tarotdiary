'use client';

import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { auth, googleProvider, db } from '../lib/firebase'; // 파이어베이스 설정 파일 경로에 맞게 수정하세요
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';

export default function Home() {
  const [user, setUser] = useState(null); // 로그인한 유저 정보
  const [currentView, setCurrentView] = useState('main');
  const [imageSrc, setImageSrc] = useState(null);
  const [question, setQuestion] = useState('');
  const [reading, setReading] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // AI 분석 로딩 상태
  const [records, setRecords] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // 1. 로그인 상태 감지 및 데이터 불러오기
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchRecords(currentUser.uid);
      } else {
        setRecords([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 구글 로그인 실행
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("로그인 실패:", error);
      alert("로그인 중 문제가 발생했습니다.");
    }
  };

  // 로그아웃 실행
  const handleLogout = async () => {
    try {
      await signOut(auth);
      resetForm();
      setCurrentView('main');
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  // Firestore에서 내 기록만 불러오기 (유저 UID 기반 격리)
  const fetchRecords = async (uid) => {
    try {
      const q = query(
        collection(db, "tarotRecords"),
        where("uid", "==", uid)
      );
      const querySnapshot = await getDocs(q);
      const loadedRecords = [];
      querySnapshot.forEach((docSnap) => {
        loadedRecords.push({ id: docSnap.id, ...docSnap.data() });
      });
      // 최신순 정렬 (클라이언트 단 정렬)
      loadedRecords.sort((a, b) => b.rawDate - a.rawDate);
      setRecords(loadedRecords);
    } catch (error) {
      console.error("기록 불러오기 실패:", error);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        setImageSrc(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ⭐️ 수정: 화면에 보이는 것뿐 아니라 실제 이미지 픽셀 자체를 회전시켜서
  // imageSrc를 완전히 교체함. 이렇게 해야 AI에게 보내는 이미지와 화면에 보이는
  // 이미지, 저장되는 이미지가 전부 일치함 (기존엔 CSS로만 화면상 회전시켜서
  // 실제 AI에게는 회전 전 원본이 그대로 전달되던 문제가 있었음).
  const rotateImage = () => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // 90도 회전이므로 가로/세로를 서로 바꿔줌
      canvas.width = img.height;
      canvas.height = img.width;

      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      setImageSrc(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = imageSrc;
  };

  const handleAiSubmit = async () => {
    if (!user) {
      alert("로그인이 필요한 서비스입니다!");
      handleGoogleLogin();
      return;
    }
    if (!question) {
      alert("질문을 입력해주세요!");
      return;
    }

    setIsLoading(true);
    setAiResult("타로 카드를 유심히 살펴보고 해석하는 중입니다... 🔮 잠시만 기다려주세요!");

    try {
      const API_KEY = process.env.NEXT_PUBLIC_GEMINI;
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const promptText = `너는 냉철하고 직관적인 타로 마스터야. 미사여구나 과장된 위로는 하지 않지만, 상대가 계속 리딩을 이어가고 싶어지도록 존중하는 태도를 유지해.

피드백을 쓸 때 반드시 지켜:
1. 먼저 리딩에서 실제로 잘 포착한 부분을 구체적으로 짚어줘 (형식적인 칭찬 말고, 정확히 어떤 카드나 상징을 잘 읽었는지 근거를 들어서).
2. 그다음 놓친 부분이나 안일했던 해석을 날카롭게 지적해.
3. 마지막은 다음에 뭘 더 눈여겨보면 좋을지 구체적인 방향을 제시하며 마무리해 (질책으로 끝내지 말고).

냉정한 분석과 존중하는 태도는 공존할 수 있어. 상대의 노력 자체는 인정하면서, 안일한 해석에는 타협하지 마.

**중요: 별표(*), 샵(#), 대시(-) 같은 마크다운 특수문자는 절대 사용하지 말고, 오직 일반 텍스트 문장과 줄바꿈만 사용해서 깔끔하게 작성해줘.**

다음 양식으로 작성해줘:
1. 잘 짚은 부분: (구체적 근거와 함께 실제로 잘 읽은 부분)
2. 놓친 부분: (안일했던 해석이나 놓친 상징에 대한 날카로운 지적)
3. 카드별 의미: (카드들의 핵심 의미 정리)
4. 다음 리딩을 위한 조언: (질책이 아닌, 다음에 눈여겨볼 방향 제시)
5. AI의 리딩: (질문과 카드 배열만 보고, 나의 리딩과는 별개로 AI가 직접 해석한 내용)

질문: ${question}
나의 리딩: ${reading || '아직 리딩을 적지 못했어.'}`;

      let contentsArray = [promptText];

      if (imageSrc) {
        const base64Data = imageSrc.split(',')[1];
        contentsArray.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: contentsArray,
      });

      let aiComment = response.text;
      aiComment = aiComment.replace(/[*#_-]/g, '');

      const now = new Date();
      const dateString = `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Firestore에 저장할 데이터 객체 (uid 포함하여 유저별 격리)
      const newRecordData = {
        uid: user.uid,
        rawDate: Date.now(),
        date: dateString,
        imageSrc: imageSrc,
        question: question,
        reading: reading,
        aiComment: aiComment
      };

      // Firestore DB에 추가
      const docRef = await addDoc(collection(db, "tarotRecords"), newRecordData);

      const savedRecord = { id: docRef.id, ...newRecordData };

      setRecords([savedRecord, ...records]);
      setCurrentPage(1);
      setAiResult(aiComment);

    } catch (error) {
      console.error(error);
      setAiResult("앗! AI 연결에 문제가 발생했어요.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setImageSrc(null);
    setQuestion('');
    setReading('');
    setAiResult(null);
  };

  const deleteRecord = async (id, event) => {
    event.stopPropagation();
    if(confirm("정말 이 기록을 삭제할까요?")) {
      try {
        await deleteDoc(doc(db, "tarotRecords", id));
        setRecords(records.filter(record => record.id !== id));
      } catch (error) {
        console.error("삭제 실패:", error);
        alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  // 페이지네이션 계산 로직
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = records.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(records.length / itemsPerPage);

  // 로그인하지 않은 경우 로그인 화면 제공
  if (!user) {
    return (
      <div style={styles.background}>
        <div style={{...styles.container, textAlign: 'center', justifyContent: 'center', minHeight: '350px'}}>
          <h1 style={styles.title}>🌙 오늘의 타로 리딩</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>나만의 소중한 타로 기록을 안전하게 보관하세요.</p>
          <button onClick={handleGoogleLogin} style={styles.primaryBtn}>
            🔵 구글 계정으로 로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'main') {
    return (
      <div style={styles.background}>
        <div style={styles.container}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '10px' }}>
            <h1 style={{ ...styles.title, border: 'none', padding: '0', margin: '0' }}>🌙 타로 리딩</h1>
            <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
          </div>

          <div>
            <p style={styles.label}>1. 뽑은 카드 사진 (선택)</p>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={styles.fileInput} />
          </div>

          {imageSrc && (
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <img
                src={imageSrc}
                alt="타로카드 미리보기"
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px'
                }}
              />
              <br />
              <button onClick={rotateImage} style={styles.rotateBtn}>🔄 사진 회전하기</button>
            </div>
          )}

          <div>
            <p style={styles.label}>2. 질문</p>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="예: 오늘 진행할 미팅의 결과는 어떨까?" style={styles.textInput} />
          </div>

          <div>
            <p style={styles.label}>3. 나의 리딩</p>
            <textarea rows="4" value={reading} onChange={(e) => setReading(e.target.value)} placeholder="카드의 상징이나 직관을 바탕으로 본인이 먼저 리딩해 본 내용을 적어주세요." style={styles.textArea} />
            <p style={styles.hintText}>💡 카드 이름과 그렇게 해석한 이유를 함께 적을수록 더 정확한 피드백을 받을 수 있어요.</p>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleAiSubmit}
              disabled={isLoading}
              style={{ ...styles.primaryBtn, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              {isLoading ? '🔮 분석 중이에요...' : '✨ 내 리딩 확인받기 (AI 분석)'}
            </button>
            <button onClick={() => setCurrentView('history')} style={styles.secondaryBtn}>
              📚 지난 피드백 기록장 보기
            </button>
          </div>

          {aiResult && (
            <div style={{...styles.detailBox, backgroundColor: '#f0ecf9', border: '1px solid #dcd3ef', marginTop: '10px'}}>
              <span style={{...styles.detailLabel, color: '#6b5b95'}}>🤖 AI 맞춤 피드백</span>
              <p style={{...styles.detailText, color: '#4a3b52', marginBottom: '15px', whiteSpace: 'pre-wrap'}}>{aiResult}</p>
              {!isLoading && (
                <button onClick={resetForm} style={styles.secondaryBtn}>🔄 새로운 리딩 준비하기</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.background}>
      <div style={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '10px' }}>
          <h1 style={{ ...styles.title, border: 'none', padding: '0', margin: '0' }}>📚 지난 기록장</h1>
          <button onClick={handleLogout} style={styles.logoutBtn}>로그아웃</button>
        </div>

        <button onClick={() => { setCurrentView('main'); resetForm(); }} style={styles.secondaryBtn}>
          ⬅️ 새로운 카드 리딩하기
        </button>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {records.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>아직 기록된 피드백이 없습니다.</p>
          ) : (
            currentRecords.map((record) => (
              <div key={record.id} style={styles.recordCard}>
                <div style={styles.recordHeader} onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px 0' }}>{record.date}</p>
                    <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, color: '#333' }}>Q. {record.question}</p>
                  </div>
                  <button onClick={(e) => deleteRecord(record.id, e)} style={styles.deleteBtn}>🗑️</button>
                </div>

                {expandedId === record.id && (
                  <div style={styles.recordDetails}>
                    {record.imageSrc && (
                      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <img
                          src={record.imageSrc}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '150px',
                            borderRadius: '8px'
                          }}
                        />
                      </div>
                    )}
                    <div style={styles.detailBox}>
                      <span style={styles.detailLabel}>나의 리딩</span>
                      <p style={styles.detailText}>{record.reading || "입력된 리딩이 없습니다."}</p>
                    </div>
                    <div style={{...styles.detailBox, backgroundColor: '#f0ecf9', border: '1px solid #dcd3ef'}}>
                      <span style={{...styles.detailLabel, color: '#6b5b95'}}>🤖 AI 피드백</span>
                      <p style={{...styles.detailText, color: '#4a3b52', whiteSpace: 'pre-wrap'}}>{record.aiComment}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 페이지네이션 버튼 영역 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{ ...styles.pageBtn, opacity: currentPage === 1 ? 0.5 : 1 }}
            >
              이전
            </button>
            <span style={{ alignSelf: 'center', fontSize: '14px', fontWeight: 'bold' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{ ...styles.pageBtn, opacity: currentPage === totalPages ? 0.5 : 1 }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  background: {
    backgroundColor: '#f4f5f7',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Pretendard', sans-serif"
  },
  container: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    maxWidth: '500px',
    width: '100%',
    height: 'fit-content',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  title: {
    color: '#6b5b95',
    fontSize: '24px',
    textAlign: 'center',
    fontWeight: '800'
  },
  label: {
    color: '#333',
    fontSize: '15px',
    fontWeight: '700',
    margin: '0 0 8px 0'
  },
  fileInput: {
    border: '1px solid #ddd',
    padding: '10px',
    borderRadius: '6px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Pretendard', sans-serif"
  },
  textInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontFamily: "'Pretendard', sans-serif"
  },
  textArea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    resize: 'vertical',
    fontFamily: "'Pretendard', sans-serif"
  },
  hintText: {
    fontSize: '12px',
    color: '#999',
    margin: '6px 2px 0 2px'
  },
  primaryBtn: {
    backgroundColor: '#6b5b95',
    color: 'white',
    border: 'none',
    padding: '14px',
    borderRadius: '6px',
    width: '100%',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '16px',
    fontFamily: "'Pretendard', sans-serif"
  },
  secondaryBtn: {
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    padding: '14px',
    borderRadius: '6px',
    width: '100%',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '15px',
    fontFamily: "'Pretendard', sans-serif"
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #ddd',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  rotateBtn: {
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    padding: '6px 12px',
    borderRadius: '20px',
    marginTop: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: "'Pretendard', sans-serif"
  },
  recordCard: {
    border: '1px solid #eaeaea',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  recordHeader: {
    padding: '15px',
    backgroundColor: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '5px',
    opacity: 0.5,
    marginLeft: '8px'
  },
  recordDetails: {
    padding: '15px',
    backgroundColor: '#fafafa',
    borderTop: '1px solid #eaeaea'
  },
  detailBox: {
    backgroundColor: '#fff',
    border: '1px solid #eee',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '10px'
  },
  detailLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#888',
    display: 'block',
    marginBottom: '5px'
  },
  detailText: {
    margin: '0',
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#333'
  },
  pageBtn: {
    padding: '8px 16px',
    backgroundColor: '#6b5b95',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontFamily: "'Pretendard', sans-serif"
  }
};