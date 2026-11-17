/**
 * ==============================================================================
 * [메인 자바스크립트 파일 - script/main.js]
 * 
 * Astral Party 공식 웹사이트 기능 모음:
 * 1. Three.js - 전체화면 3D 인게임 보드맵 실시간 렌더링 & 타일 강조 & 말 점프
 * 2. GSAP & ScrollTrigger - 전체화면 스크롤 연동 3D 회전 & 미니멀 카드 전환
 * 3. Lenis.js - 부드러운 감속 스크롤 (Smooth Scroll)
 * 4. Swiper.js - 최신 이벤트 & 게임 소개 캐러셀
 * 5. 트레일러 모달, 탭 바로가기, 모바일 메뉴
 * ==============================================================================
 */

const initAstralParty = () => {
  console.log('%c🎲 Astral Party Fullscreen 3D Board Loaded!', 'color: #f43f5e; font-size: 16px; font-weight: bold;');

  // --------------------------------------------------------------------------
  // 1. Lenis 부드러운 스크롤 (Smooth Scroll) 초기화
  // --------------------------------------------------------------------------
  let lenis = null;

  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.6,
    });

    lenis.on('scroll', () => {
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.update();
      }
    });

    if (typeof gsap !== 'undefined') {
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  // --------------------------------------------------------------------------
  // 2. Swiper.js 최신 이벤트 & 게임 소개 슬라이더 (엣지 프로그레스 바 일체형)
  // --------------------------------------------------------------------------
  if (typeof Swiper !== 'undefined') {
    const AUTOPLAY_TIME = 4500;
    const progressSegments = document.querySelectorAll('.edge-progress-segment');

    function updateEdgeProgress(realIndex, fillPercent) {
      progressSegments.forEach((segment, idx) => {
        const fill = segment.querySelector('.edge-progress-fill');
        if (idx === realIndex) {
          segment.classList.add('active');
          if (fill) fill.style.width = `${Math.min(100, Math.max(0, fillPercent))}%`;
        } else {
          segment.classList.remove('active');
          if (fill) fill.style.width = '0%';
        }
      });
    }

    let isDragging = false;

    function handleDragProgress(s) {
      if (!s || !s.touches) return;
      const diff = s.touches.diff || 0;
      const width = s.width || (s.el ? s.el.clientWidth : 1);
      const total = progressSegments.length;
      const currentIndex = s.realIndex || 0;

      if (diff < 0) {
        // 드래그를 왼쪽으로 당김 (다음 슬라이드로 진행): 현재 슬라이드 바가 0%에서 100%로 채워짐
        const fillPercent = Math.min(100, Math.max(0, (-diff / width) * 100));
        updateEdgeProgress(currentIndex, fillPercent);
      } else if (diff > 0) {
        // 드래그를 오른쪽으로 당김 (이전 슬라이드로 되돌림): 이전 슬라이드 바가 드래그 거리에 비례하여 채워짐
        const prevIndex = (currentIndex - 1 + total) % total;
        const fillPercent = Math.min(100, Math.max(0, (diff / width) * 100));
        progressSegments.forEach((segment, idx) => {
          const fill = segment.querySelector('.edge-progress-fill');
          if (idx === prevIndex) {
            segment.classList.add('active');
            if (fill) fill.style.width = `${fillPercent}%`;
          } else {
            segment.classList.remove('active');
            if (fill) fill.style.width = '0%';
          }
        });
      }
    }

    const eventSwiper = new Swiper('.myEventSwiper', {
      slidesPerView: 1,
      spaceBetween: 0,
      loop: true,
      speed: 650,
      grabCursor: true,
      autoplay: {
        delay: AUTOPLAY_TIME,
        disableOnInteraction: false,
        pauseOnMouseEnter: false,
      },
      on: {
        init() {
          updateEdgeProgress(this.realIndex || 0, 0);
        },
        touchStart() {
          isDragging = true;
        },
        sliderMove(s) {
          isDragging = true;
          handleDragProgress(s);
        },
        setTranslate(s) {
          if (isDragging || (s.touchEventsData && s.touchEventsData.isTouched)) {
            handleDragProgress(s);
          }
        },
        touchEnd() {
          isDragging = false;
        },
        slideChange() {
          updateEdgeProgress(this.realIndex || 0, 0);
        },
        slideChangeTransitionStart() {
          updateEdgeProgress(this.realIndex || 0, 0);
        },
        slideResetTransitionStart() {
          updateEdgeProgress(this.realIndex || 0, 0);
        },
        autoplayTimeLeft(s, time, progress) {
          // 직접 드래그 중일 때는 드래그 진행률 유지
          if (isDragging) return;
          // progress는 1에서 0으로 감소 (Swiper v11 기준)
          const fillPercent = (1 - progress) * 100;
          updateEdgeProgress(s.realIndex || 0, fillPercent);
        },
      },
    });

    // 엣지 프로그레스 세그먼트 클릭 시 해당 슬라이드로 즉시 전환
    progressSegments.forEach((segment) => {
      segment.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slideIdx = parseInt(segment.getAttribute('data-slide-to'), 10);
        if (!isNaN(slideIdx) && eventSwiper) {
          eventSwiper.slideToLoop(slideIdx);
          updateEdgeProgress(slideIdx, 0);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 3. Three.js - 전체화면 3D 인게임 보드맵 실시간 렌더링
  // --------------------------------------------------------------------------
  const canvas3D = document.getElementById('board-3d-canvas');
  let update3DBoardStep = null;
  let currentActiveDice = 1;
  let switchDiceByStep = null;
  let jumpToDiceTab = null;

  if (canvas3D && typeof THREE !== 'undefined') {
    initThreeJsFullscreenBoard();
  }

  function initThreeJsFullscreenBoard() {
    const canvasWrap = document.getElementById('board3DCanvasWrap') || canvas3D.parentElement;
    let width = canvasWrap && canvasWrap.clientWidth > 0 ? canvasWrap.clientWidth : Math.floor(window.innerWidth * 0.55);
    let height = canvasWrap && canvasWrap.clientHeight > 0 ? canvasWrap.clientHeight : window.innerHeight;

    // 씬(Scene) 생성 - CSS 대각선 그라디언트 배경이 투과되도록 투명 배경 설정
    const scene = new THREE.Scene();
    scene.background = null;

    // 카메라(Camera) 생성 - 데스크톱/모바일 비율에 맞춰 보드판 전체가 여유롭게 프레이밍
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const updateCameraFraming = (w, h) => {
      const aspect = w / Math.max(1, h);
      const distFactor = aspect < 1.0 ? Math.min(1.45, 1.02 / aspect) : 1;
      camera.aspect = aspect;
      camera.position.set(0, 15 * distFactor, 20 * distFactor);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    updateCameraFraming(width, height);

    // 렌더러(Renderer) 생성 (투명도 alpha: true)
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas3D,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (renderer.outputColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    // [조명 설정 - 밝고 경쾌한 파티 게임 무드]
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight1.position.set(12, 22, 12);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xfce7f3, 1.1);
    dirLight2.position.set(-12, 18, -12);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x60a5fa, 2.2, 35);
    pointLight.position.set(0, 4.5, 0);
    scene.add(pointLight);

    // 하부 바운스 라이트 (어두운 그림자를 화사하게 밝혀줌)
    const bounceLight = new THREE.DirectionalLight(0xddd6fe, 0.85);
    bounceLight.position.set(0, -10, 0);
    scene.add(bounceLight);

    // [3D 보드맵 메인 그룹]
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // 1. 공중에 떠있는 세련된 딥 코스믹 보드 아일랜드 받침대 (흰색을 세련된 다크 코스믹으로 변경하여 말과 타일의 시인성 대폭 강화)
    const baseGeo = new THREE.CylinderGeometry(8.5, 7.8, 1.2, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x151b32,
      roughness: 0.35,
      metalness: 0.35,
    });
    const islandBase = new THREE.Mesh(baseGeo, baseMat);
    islandBase.position.y = -0.6;
    boardGroup.add(islandBase);

    // 타일 경로를 연결하는 은은한 네온 궤도 링
    const orbitRingGeo = new THREE.TorusGeometry(5.8, 0.04, 16, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.7 });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2;
    orbitRing.position.y = 0.05;
    boardGroup.add(orbitRing);

    // 0. 보드판 전체 원형 히트 감지 투명 실린더 (반경 9.0으로 타일 사이 빈틈없는 정밀 감지)
    const hitCylinderGeo = new THREE.CylinderGeometry(9.0, 9.0, 2.5, 32);
    const hitCylinderMat = new THREE.MeshBasicMaterial({ visible: false });
    const boardHitZone = new THREE.Mesh(hitCylinderGeo, hitCylinderMat);
    boardHitZone.position.y = 0;
    boardGroup.add(boardHitZone);

    // 산뜻한 골드 네온 외곽 림
    const rimGeo = new THREE.TorusGeometry(8.6, 0.12, 16, 64);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.02;
    boardGroup.add(rimMesh);

    // 2. 중앙 코스믹 파티 크리스탈 큐브 (화사한 마젠타 핑크 루비)
    const centerCoreGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const centerCoreMat = new THREE.MeshStandardMaterial({
      color: 0xef25cb,
      roughness: 0.15,
      metalness: 0.7,
      emissive: 0xa21caf,
      emissiveIntensity: 0.6,
    });
    const centerCore = new THREE.Mesh(centerCoreGeo, centerCoreMat);
    centerCore.position.y = 1.6;
    centerCore.rotation.x = Math.PI / 4;
    centerCore.rotation.y = Math.PI / 4;
    boardGroup.add(centerCore);

    // 3. 6대 핵심 타일 배치 (원형 궤도에 6개 타일)
    const TILE_RADIUS = 5.8;
    const tileColors = [
      0xf43f5e, // 1: 공지사항 (핑크/레드)
      0xfb7185, // 2: 캐릭터 (스트로베리)
      0x6366f1, // 3: 카드 (인디고/블루)
      0x10b981, // 4: 맵 (에메랄드 그린)
      0xf59e0b, // 5: 재화구매 (골드 옐로우)
      0x0ea5e9, // 6: 건의사항 (스카이 블루)
    ];

    const tileMeshes = [];
    const tilePositions = [];

    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = Math.sin(angle) * TILE_RADIUS;
      const z = Math.cos(angle) * TILE_RADIUS;
      tilePositions.push({ x, y: 0.35, z, angle });

      // 타일 블록
      const tileBlockGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.7, 6);
      const tileBlockMat = new THREE.MeshStandardMaterial({
        color: tileColors[i],
        roughness: 0.3,
        metalness: 0.5,
      });
      const tileBlock = new THREE.Mesh(tileBlockGeo, tileBlockMat);
      tileBlock.position.set(x, 0.35, z);
      boardGroup.add(tileBlock);
      tileMeshes.push(tileBlock);

      // 타일 상단 빛나는 별모양 표식 (화사한 골드 옐로우)
      const starGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const starMesh = new THREE.Mesh(starGeo, starMat);
      starMesh.position.set(x, 0.72, z);
      boardGroup.add(starMesh);

      // 연결 디딤돌 (Stepping Stones - 산뜻한 네온 시안으로 선명한 대비)
      const nextAngle = ((i + 1) * Math.PI) / 3;
      const midAngle = (angle + nextAngle) / 2;
      const midX = Math.sin(midAngle) * TILE_RADIUS;
      const midZ = Math.cos(midAngle) * TILE_RADIUS;
      
      const stepGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.3, 6);
      const stepMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.25,
        metalness: 0.3,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
      });
      const stepMesh = new THREE.Mesh(stepGeo, stepMat);
      stepMesh.position.set(midX, 0.15, midZ);
      boardGroup.add(stepMesh);
    }

    // 4. 활성화 타일 강조 펄스 링 (Active Glow Beam Ring)
    const beamRingGeo = new THREE.TorusGeometry(1.5, 0.09, 16, 32);
    const beamRingMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const beamRing = new THREE.Mesh(beamRingGeo, beamRingMat);
    beamRing.rotation.x = Math.PI / 2;
    beamRing.position.set(tilePositions[0].x, 0.78, tilePositions[0].z);
    boardGroup.add(beamRing);

    // 5. 3D 플레이어 주사위 말 (Player Pawn - 고시인성 골드 & 마젠타)
    const pawnGroup = new THREE.Group();
    // 말 밑단 (골드 메탈 받침)
    const pawnBaseGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.25, 24);
    const pawnBaseMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0xb45309,
      emissiveIntensity: 0.25,
    });
    const pawnBase = new THREE.Mesh(pawnBaseGeo, pawnBaseMat);
    pawnBase.position.y = 0.12;
    pawnGroup.add(pawnBase);

    // 말 몸통 (선명한 파티 핫핑크)
    const pawnBodyGeo = new THREE.ConeGeometry(0.48, 0.9, 24);
    const pawnBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.2,
      metalness: 0.3,
      emissive: 0xbe123c,
      emissiveIntensity: 0.25,
    });
    const pawnBody = new THREE.Mesh(pawnBodyGeo, pawnBodyMat);
    pawnBody.position.y = 0.65;
    pawnGroup.add(pawnBody);

    // 말 머리 (하얀색 대신 또렷하고 화사한 골드 앰버 오브 - 시인성 대폭 개선)
    const pawnHeadGeo = new THREE.SphereGeometry(0.42, 24, 24);
    const pawnHeadMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.15,
      metalness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
    });
    const pawnHead = new THREE.Mesh(pawnHeadGeo, pawnHeadMat);
    pawnHead.position.y = 1.25;
    pawnGroup.add(pawnHead);

    // 말 왕관 별 (Crown Star)
    const crownGeo = new THREE.TetrahedronGeometry(0.28);
    const crownMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const crownMesh = new THREE.Mesh(crownGeo, crownMat);
    crownMesh.position.y = 1.72;
    pawnGroup.add(crownMesh);

    // 말 전용 발광 포인트 라이트 (말의 머리와 서 있는 타일을 화사하게 비춰줌)
    const pawnLight = new THREE.PointLight(0xfef08a, 1.4, 4.5);
    pawnLight.position.y = 1.35;
    pawnGroup.add(pawnLight);

    // 초기 위치
    pawnGroup.position.set(tilePositions[0].x, 0.7, tilePositions[0].z);
    boardGroup.add(pawnGroup);

    // 6. 파티 크리스탈 파티클 (Party Crystal Motes)
    const starCount = 120;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 40;
      starPositions[i + 1] = (Math.random() - 0.2) * 22;
      starPositions[i + 2] = (Math.random() - 0.5) * 40;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starParticleMat = new THREE.PointsMaterial({
      color: 0xef25cb,
      size: 0.18,
      transparent: true,
      opacity: 0.6,
    });
    const starField = new THREE.Points(starGeom, starParticleMat);
    scene.add(starField);

    // [상태 및 조작 변수]
    let currentStepIndex = 0;
    let targetRotationY = 0;
    let manualDragOffset = 0;
    let isMouseDown = false;
    let prevMouseX = 0;

    let pawnJumpProgress = 1;
    let pawnStartPos = new THREE.Vector3().copy(pawnGroup.position);
    let pawnEndPos = new THREE.Vector3().copy(pawnGroup.position);

    // [마우스/터치 좌우 자유 드래그: 드래그 거리에 비례하여 원하는 만큼 탭과 말이 부드럽게 이동]
    let dragStartX = 0;
    let dragStartY = 0;
    let dragInitialStep = 1;
    let dragInitialRotation = 0;
    let dragDistanceX = 0;
    let hasMoved = false;

    // 드래그 민감도: 약 100px 좌우 드래그당 1칸(60도)씩 이동
    const PIXELS_PER_STEP = 110;

    const onDragStart = (clientX, clientY) => {
      isMouseDown = true;
      dragStartX = clientX;
      dragStartY = clientY;
      prevMouseX = clientX;
      dragInitialStep = currentActiveDice;
      dragInitialRotation = targetRotationY;
      dragDistanceX = 0;
      hasMoved = false;
    };

    const onDragMove = (clientX, clientY) => {
      if (!isMouseDown) return;

      const diffX = clientX - dragStartX;
      const diffY = clientY - dragStartY;
      prevMouseX = clientX;

      // 수평 드래그 의도 판별 (최소 8px 이상 수평 이동)
      if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY)) {
        hasMoved = true;
      }

      if (hasMoved) {
        dragDistanceX = diffX;

        // 드래그한 거리만큼 보드판 각도를 실시간으로 부드럽게 회전
        const anglePerPixel = (Math.PI / 3) / PIXELS_PER_STEP;
        manualDragOffset = diffX * anglePerPixel;

        // 드래그 이동 거리에 따라 실시간 목표 탭 계산 (6 <-> 1 무한 순환)
        // 왼쪽 드래그(diffX < 0) -> +칸(다음), 오른쪽 드래그(diffX > 0) -> -칸(이전)
        const stepDelta = Math.round(-diffX / PIXELS_PER_STEP);
        const liveStep = ((dragInitialStep - 1 + stepDelta) % 6 + 6) % 6 + 1;

        if (liveStep !== currentActiveDice) {
          currentActiveDice = liveStep;
          activateStep(liveStep, false);
        }
      }
    };

    // [보드판 레이캐스터 및 스마트 휠 스크롤 인터랙션]
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();
    let isHoveringBoard = false;
    let wheelCooldown = false;
    let accumulatedDelta = 0;

    const checkBoardIntersection = (clientX, clientY) => {
      const rect = canvas3D.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return false;
      }
      mouseVector.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseVector.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(boardGroup.children, true);
      return intersects.length > 0;
    };

    const onDragEnd = (clientX) => {
      if (!isMouseDown) return;
      isMouseDown = false;

      if (hasMoved) {
        // 드래그 완료 시 6 <-> 1 순환하여 스냅
        const finalDiffX = clientX - dragStartX;
        const stepDelta = Math.round(-finalDiffX / PIXELS_PER_STEP);
        const finalStep = ((dragInitialStep - 1 + stepDelta) % 6 + 6) % 6 + 1;

        manualDragOffset = 0;
        targetRotationY = dragInitialRotation - stepDelta * (Math.PI / 3);
        currentActiveDice = finalStep;
        activateStep(finalStep, true);
      } else {
        manualDragOffset = 0;
        // 단순 클릭 시: 타일을 직접 클릭했는지 레이캐스트 판정
        const rect = canvas3D.getBoundingClientRect();
        mouseVector.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseVector.y = -((dragStartY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVector, camera);
        const tileHits = raycaster.intersectObjects(tileMeshes);
        if (tileHits.length > 0) {
          const hitIdx = tileMeshes.indexOf(tileHits[0].object);
          if (hitIdx !== -1) {
            jumpToDiceTab(hitIdx + 1);
          }
        }
      }
      hasMoved = false;
    };

    // 마우스 이벤트 등록 (캔버스 및 섹션 전체에서 부드럽게 드래그 지원)
    canvas3D.addEventListener('mousedown', (e) => {
      onDragStart(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', (e) => {
      if (isMouseDown) {
        onDragEnd(e.clientX);
      }
    });

    window.addEventListener('mousemove', (e) => {
      onDragMove(e.clientX, e.clientY);
      // 마우스가 보드판 위에 있을 때 grab 커서 표시, 배경일 때 default
      if (!isMouseDown) {
        isHoveringBoard = checkBoardIntersection(e.clientX, e.clientY);
        canvas3D.style.cursor = isHoveringBoard ? 'grab' : 'default';
      }
    });

    // ★ 유저 핵심 요청 1 & 2:
    // 1) "보드판에 대고 스크롤을 할때는 스크롤이 거기에서 멈췄으면 좋겠어. 보드판이 아닌 주변 여백은 여전히 그대로 스크롤이 되게."
    // 2) "마지막에서 오른쪽으로 더 갈때는 첫번째가 나오게, 첫번째에서 왼쪽으로 더 갈때는 마지막이 나오게 해서 이어지게"
    const handleGlobalWheel = (e) => {
      const section3D = document.querySelector('.section-fullscreen-3d');
      if (!section3D) return;

      const secRect = section3D.getBoundingClientRect();
      // 3D 보드판 섹션이 화면에 보이고 있는 상태인지 확인
      if (secRect.bottom <= 0 || secRect.top >= window.innerHeight) {
        return;
      }

      // 커서가 3D 보드판 섹션 뷰포트 영역 안에 있는지 확인
      if (
        e.clientY < secRect.top ||
        e.clientY > secRect.bottom ||
        e.clientX < secRect.left ||
        e.clientX > secRect.right
      ) {
        return;
      }

      // 3D 보드판(원형 섬/타일/캐릭터) 위인지 레이캐스트 정밀 판정
      const overBoard = checkBoardIntersection(e.clientX, e.clientY);

      if (overBoard) {
        // [보드판 위]:
        // ★ 페이지 스크롤을 100% 완벽 차단! (Lenis 및 브라우저 네이티브 스크롤 전파 즉시 정지)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (wheelCooldown) return;

        // 세로 스크롤(deltaY) 또는 가로 트랙패드(deltaX)
        const primaryDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        accumulatedDelta += primaryDelta;

        const SCROLL_THRESHOLD = 18;
        if (Math.abs(accumulatedDelta) >= SCROLL_THRESHOLD) {
          // delta > 0 (아래/오른쪽으로 스크롤) -> 다음 칸(+1)
          // delta < 0 (위/왼쪽으로 스크롤) -> 이전 칸(-1)
          const stepDir = accumulatedDelta > 0 ? 1 : -1;
          accumulatedDelta = 0;

          if (switchDiceByStep) {
            switchDiceByStep(stepDir);
          }

          wheelCooldown = true;
          setTimeout(() => {
            wheelCooldown = false;
          }, 200); // 200ms 부드러운 전환 쿨다운
        }
      } else {
        // [보드판 주변 우주 배경/여백 위]:
        // 아무것도 차단하지 않아 일반 페이지 스크롤이 자연스럽게 넘어감!
        accumulatedDelta = 0;
      }
    };

    // window의 캡처(capture) 단계에서 이벤트를 가로채어 Lenis 및 기본 스크롤을 100% 통제
    window.addEventListener('wheel', handleGlobalWheel, { capture: true, passive: false });

    // 모바일 터치 이벤트 등록
    canvas3D.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (isMouseDown) {
        const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : prevMouseX;
        onDragEnd(endX);
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (isMouseDown && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    // [단계별 보드 타일 3D 회전 및 말 점프 함수]
    update3DBoardStep = (stepNumber, shouldResetDragOffset = true) => {
      const idx = Math.max(0, Math.min(5, stepNumber - 1));
      currentStepIndex = idx;
      if (shouldResetDragOffset) {
        manualDragOffset = 0;
      }

      // 목표 각도로 최단 거리 부드러운 회전 (6 -> 1, 1 -> 6 전환 시 300도 역회전 없이 60도 연속 회전)
      const baseTargetAngle = -tilePositions[idx].angle;
      let diff = (baseTargetAngle - targetRotationY) % (Math.PI * 2);
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;
      targetRotationY += diff;

      // 강조 링 위치 이동
      beamRing.position.set(tilePositions[idx].x, 0.78, tilePositions[idx].z);
      beamRing.material.color.setHex(tileColors[idx]);

      // 말 점프 이동 시작
      pawnStartPos.copy(pawnGroup.position);
      pawnEndPos.set(tilePositions[idx].x, 0.7, tilePositions[idx].z);
      pawnJumpProgress = 0;
    };

    // [렌더 루프]
    let clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // 1. 보드맵 부드러운 감속 회전
      const currentRot = boardGroup.rotation.y;
      const desiredRot = targetRotationY + manualDragOffset;
      boardGroup.rotation.y += (desiredRot - currentRot) * (delta * 4.5);

      // 2. 중앙 크리스탈 회전
      centerCore.rotation.x = time * 0.4;
      centerCore.rotation.y = time * 0.6;
      centerCore.position.y = 1.6 + Math.sin(time * 2) * 0.15;

      // 3. 링 펄스
      beamRing.scale.setScalar(1 + Math.sin(time * 4) * 0.08);

      // 4. 말 포물선 점프 애니메이션
      if (pawnJumpProgress < 1) {
        pawnJumpProgress += delta * 2.2;
        if (pawnJumpProgress > 1) pawnJumpProgress = 1;

        pawnGroup.position.x = THREE.MathUtils.lerp(pawnStartPos.x, pawnEndPos.x, pawnJumpProgress);
        pawnGroup.position.z = THREE.MathUtils.lerp(pawnStartPos.z, pawnEndPos.z, pawnJumpProgress);
        const arcY = Math.sin(pawnJumpProgress * Math.PI) * 1.5;
        pawnGroup.position.y = THREE.MathUtils.lerp(pawnStartPos.y, pawnEndPos.y, pawnJumpProgress) + arcY;
      } else {
        pawnGroup.position.y = 0.7 + Math.sin(time * 3) * 0.04;
      }

      // 5. 별빛 파티클 자전
      starField.rotation.y = time * 0.03;

      renderer.render(scene, camera);
    }

    animate();

    // 화면 리사이즈 (캔버스 랩 크기 기준 + 모바일 비율 대응)
    const handleBoardResize = () => {
      const wrap = document.getElementById('board3DCanvasWrap') || canvas3D.parentElement;
      const nextWidth = wrap && wrap.clientWidth > 0 ? wrap.clientWidth : window.innerWidth;
      const nextHeight = wrap && wrap.clientHeight > 0 ? wrap.clientHeight : window.innerHeight;
      if (nextWidth > 0 && nextHeight > 0) {
        width = nextWidth;
        height = nextHeight;
        updateCameraFraming(width, height);
        renderer.setSize(width, height, false);
      }
    };

    window.addEventListener('resize', handleBoardResize);
    if (typeof ResizeObserver !== 'undefined' && canvasWrap) {
      const boardResizeObserver = new ResizeObserver(handleBoardResize);
      boardResizeObserver.observe(canvasWrap);
    }
    setTimeout(handleBoardResize, 200);
  }

  // --------------------------------------------------------------------------
  // 4. GSAP & ScrollTrigger - 전체화면 스크롤 연동 3D 보드 및 미니멀 카드 전환
  // --------------------------------------------------------------------------
  const pillButtons = document.querySelectorAll('.dice-pill-btn');
  const minimalCards = document.querySelectorAll('.minimal-tile-card');

  function activateStep(stepNum, shouldResetDragOffset = true) {
    currentActiveDice = stepNum;

    // 1. 3D 보드맵 회전 및 말 점프
    if (update3DBoardStep) {
      update3DBoardStep(stepNum, shouldResetDragOffset);
    }

    // 2. 상단 퀵 점프 필 버튼 활성화
    pillButtons.forEach((btn) => {
      if (parseInt(btn.getAttribute('data-target-dice') || '0', 10) === stepNum) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // 3. 하단 미니멀 콘텐츠 카드 전환
    minimalCards.forEach((card) => {
      if (parseInt(card.getAttribute('data-dice') || '0', 10) === stepNum) {
        card.classList.add('is-active');
      } else {
        card.classList.remove('is-active');
      }
    });

    // 4. 우측 3D 행운의 주사위 면 동기화
    if (window.syncLuckyDiceFace) {
      window.syncLuckyDiceFace(stepNum);
    }
  }

  // 1~6 주사위 탭으로 직접 전환 (380vh 스크롤 고정 없이 즉시 3D 회전 및 탭 전환)
  jumpToDiceTab = function (targetDice) {
    const clampedDice = Math.max(1, Math.min(6, targetDice));
    currentActiveDice = clampedDice;
    activateStep(clampedDice);
  };

  // 좌우 드래그 및 휠 스크롤 시 상대 단계로 탭 이동 (-1: 이전, +1: 다음, 1~6 무한 순환)
  switchDiceByStep = function (direction) {
    let nextDice = currentActiveDice + direction;
    if (nextDice < 1) nextDice = 6;
    if (nextDice > 6) nextDice = 1;
    jumpToDiceTab(nextDice);
  };

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // [A. 대문 히어로 애니메이션 (버튼 가시성 100% 영구 보장)]
    gsap.set('.hero-btn-group, .hero-btn-group .btn', { opacity: 1, visibility: 'visible', clearProps: 'all' });

    const heroTl = gsap.timeline({ 
      defaults: { ease: 'power3.out', duration: 0.8 },
      onComplete: () => {
        gsap.set('.hero-badge-row, .hero-title, .hero-btn-group .btn, .hero-stats-strip .stat-item', { clearProps: 'all' });
      }
    });
    heroTl
      .from('.hero-badge-row', { y: -16, opacity: 0, delay: 0.1, clearProps: 'all' })
      .from('.hero-title', { y: 24, opacity: 0, clearProps: 'all' }, '-=0.5')
      .from('.hero-stats-strip .stat-item', { scale: 0.95, opacity: 0, stagger: 0.08, clearProps: 'all' }, '-=0.3');

    // [B. 대표 일러스트 전체화면 인터랙티브 3D 패럴렉스 & 마우스 반응 시스템]
    const heroSectionEl = document.querySelector('.hero-section');
    const heroArtWrapEl = document.getElementById('heroArtWrap');
    const heroSpotlightEl = document.getElementById('heroCursorSpotlight');
    const heroHudEl = document.getElementById('heroHud');
    const toggleImmersionBtn = document.getElementById('toggleImmersionBtn');

    if (heroSectionEl && heroArtWrapEl) {
      let mouseX = 0;
      let mouseY = 0;
      let targetArtX = 0;
      let targetArtY = 0;
      let targetRotX = 0;
      let targetRotY = 0;
      let currentArtX = 0;
      let currentArtY = 0;
      let currentRotX = 0;
      let currentRotY = 0;

      let targetSpotX = 0;
      let targetSpotY = 0;
      let currentSpotX = 0;
      let currentSpotY = 0;

      const onHeroMouseMove = (e) => {
        const rect = heroSectionEl.getBoundingClientRect();
        // 정규화 좌표 (-1 ~ 1)
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        mouseX = Math.max(-1, Math.min(1, x));
        mouseY = Math.max(-1, Math.min(1, y));

        // 전체화면 캔버스 카메라 팬 & 틸트 각도 계산 (마우스 반대 방향으로 이동하여 카메라 시점 효과)
        targetArtX = -mouseX * 36; // 좌우 36px 팬
        targetArtY = -mouseY * 26; // 상하 26px 팬
        targetRotY = mouseX * 4.5; // 좌우 4.5도 틸트
        targetRotX = -mouseY * 4.0; // 상하 4.0도 틸트

        // 커서 조명 스포트라이트 위치 추적
        targetSpotX = e.clientX - rect.left;
        targetSpotY = e.clientY - rect.top;
        if (heroSpotlightEl) {
          heroSpotlightEl.style.opacity = '1';
        }
      };

      const onHeroMouseLeave = () => {
        mouseX = 0;
        mouseY = 0;
        targetArtX = 0;
        targetArtY = 0;
        targetRotX = 0;
        targetRotY = 0;
        if (heroSpotlightEl) {
          heroSpotlightEl.style.opacity = '0';
        }
      };

      const animateHeroFullscreen = () => {
        // 부드러운 가속/감속 보간 (lerp)
        currentArtX += (targetArtX - currentArtX) * 0.07;
        currentArtY += (targetArtY - currentArtY) * 0.07;
        currentRotX += (targetRotX - currentRotX) * 0.07;
        currentRotY += (targetRotY - currentRotY) * 0.07;

        heroArtWrapEl.style.transform = `scale(1.1) translate3d(${currentArtX.toFixed(2)}px, ${currentArtY.toFixed(2)}px, 0) rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg)`;

        // 커서 스포트라이트 조명 부드러운 추적
        if (heroSpotlightEl) {
          currentSpotX += (targetSpotX - currentSpotX) * 0.12;
          currentSpotY += (targetSpotY - currentSpotY) * 0.12;
          heroSpotlightEl.style.left = `${currentSpotX.toFixed(1)}px`;
          heroSpotlightEl.style.top = `${currentSpotY.toFixed(1)}px`;
        }

        // 전면 HUD 텍스트 레이어의 은은한 반대 방향 시차
        if (heroHudEl) {
          const hudShiftX = mouseX * 8;
          const hudShiftY = mouseY * 6;
          heroHudEl.style.transform = `translate3d(${hudShiftX.toFixed(1)}px, ${hudShiftY.toFixed(1)}px, 0)`;
        }

        requestAnimationFrame(animateHeroFullscreen);
      };

      heroSectionEl.addEventListener('mousemove', onHeroMouseMove, { passive: true });
      heroSectionEl.addEventListener('mouseleave', onHeroMouseLeave, { passive: true });
      animateHeroFullscreen();

      // [C. 몰입 모드 (Immersion Mode) 핸들러 - 우측 상단 소형 버튼 & 클릭/스크롤 시 즉시 해제]
      if (toggleImmersionBtn) {
        let isImmersion = false;

        const dismissImmersion = (evt) => {
          if (!isImmersion) return;
          isImmersion = false;
          document.body.classList.remove('immersion-mode-active');
          heroSectionEl.classList.remove('hero-immersion-active');

          window.removeEventListener('click', dismissImmersion, true);
          window.removeEventListener('wheel', dismissImmersion, true);
          window.removeEventListener('scroll', dismissImmersion, true);
          window.removeEventListener('touchmove', dismissImmersion, true);
          window.removeEventListener('keydown', onKeyDownDismiss, true);

          if (evt && evt.type === 'click') {
            evt.preventDefault();
            evt.stopPropagation();
          }
        };

        const onKeyDownDismiss = (evt) => {
          dismissImmersion(evt);
        };

        const enterImmersion = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (isImmersion) return;
          isImmersion = true;

          document.body.classList.add('immersion-mode-active');
          heroSectionEl.classList.add('hero-immersion-active');

          setTimeout(() => {
            if (!isImmersion) return;
            window.addEventListener('click', dismissImmersion, true);
            window.addEventListener('wheel', dismissImmersion, true);
            window.addEventListener('scroll', dismissImmersion, true);
            window.addEventListener('touchmove', dismissImmersion, true);
            window.addEventListener('keydown', onKeyDownDismiss, true);
          }, 120);
        };

        toggleImmersionBtn.addEventListener('click', enterImmersion);
      }

      // 스크롤 시 전체화면 이미지가 은은한 시차로 자연스럽게 이동하는 ScrollTrigger
      gsap.to(heroArtWrapEl, {
        scrollTrigger: {
          trigger: heroSectionEl,
          start: 'top top',
          end: 'bottom top',
          scrub: 1.2,
        },
        yPercent: 12,
        ease: 'none',
      });

      if (heroHudEl) {
        gsap.to(heroHudEl, {
          scrollTrigger: {
            trigger: heroSectionEl,
            start: 'top top',
            end: '60% top',
            scrub: 1,
          },
          y: 60,
          opacity: 0.2,
          ease: 'none',
        });
      }
    }

    // [C. 스팀 사양 섹션 등장 애니메이션]
    gsap.from('.steam-cta-banner', {
      scrollTrigger: {
        trigger: '.steam-specs-section',
        start: 'top 80%',
      },
      y: 35,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out',
    });
  }

  // --------------------------------------------------------------------------
  // 5. 1~6 주사위 탭 클릭 시 해당 단계 위치로 이동
  // --------------------------------------------------------------------------
  pillButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetDice = parseInt(btn.getAttribute('data-target-dice') || '1', 10);
      jumpToDiceTab(targetDice);
    });
  });

  // --------------------------------------------------------------------------
  // 5-1. 3D 인터랙티브 행운의 물음표 주사위 (Three.js Scene)
  // --------------------------------------------------------------------------
  const luckyDiceCanvas = document.getElementById('lucky-dice-canvas');
  if (luckyDiceCanvas && typeof THREE !== 'undefined') {
    const diceContainer = document.getElementById('boardTopSlotArea') || luckyDiceCanvas.parentElement;
    let diceWidth = diceContainer && diceContainer.clientWidth > 0 ? diceContainer.clientWidth : 420;
    let diceHeight = diceContainer && diceContainer.clientHeight > 0 ? diceContainer.clientHeight : 270;

    const diceScene = new THREE.Scene();
    const diceCamera = new THREE.PerspectiveCamera(40, diceWidth / diceHeight, 0.1, 100);
    diceCamera.position.set(0, 0, 7.0);

    const diceRenderer = new THREE.WebGLRenderer({
      canvas: luckyDiceCanvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    diceRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    diceRenderer.setSize(diceWidth, diceHeight, false);
    if ('outputColorSpace' in diceRenderer) {
      diceRenderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    // 조명 세팅 (풍부한 네온 게임 광원)
    const diceAmbient = new THREE.AmbientLight(0xffffff, 1.25);
    diceScene.add(diceAmbient);

    const diceKeyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    diceKeyLight.position.set(4, 6, 6);
    diceScene.add(diceKeyLight);

    const diceRimLight = new THREE.DirectionalLight(0xef25cb, 2.2);
    diceRimLight.position.set(-5, -3, 3);
    diceScene.add(diceRimLight);

    const diceCyanLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    diceCyanLight.position.set(0, -5, -4);
    diceScene.add(diceCyanLight);

    // 주사위 6개 면을 위한 캔버스 프로시저럴 텍스처 생성
    // (아스트랄 파티 고유의 입체적인 ? 마크와 골드 화살표 코너 베벨)
    function createDiceFaceTexture(diceNumber, borderColor) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d');

      // 1. 입체적인 은은한 펄 화이트 바탕
      const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 320);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.8, '#f8fafc');
      grad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // 2. 가장자리 컬러 베벨 테두리
      ctx.lineWidth = 32;
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(16, 16, 480, 480);

      // 3. 골드 코너 화살표 팁
      const drawCorner = (x, y, angle) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(52, 0);
        ctx.lineTo(52, 22);
        ctx.lineTo(22, 22);
        ctx.lineTo(22, 52);
        ctx.lineTo(0, 52);
        ctx.closePath();
        ctx.fillStyle = '#fde047';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ca8a04';
        ctx.stroke();
        ctx.restore();
      };
      drawCorner(28, 28, 0);
      drawCorner(484, 28, Math.PI / 2);
      drawCorner(484, 484, Math.PI);
      drawCorner(28, 484, -Math.PI / 2);

      // 4. 중앙 볼드 ? 마크 (입체 그라디언트 + 강렬한 다크 아웃라인)
      ctx.font = '900 250px "Pretendard", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 그림자
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillText('?', 262, 266);

      // 다크 테두리
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#581c87';
      ctx.strokeText('?', 256, 256);

      // 코어 비비드 그라데이션
      const textGrad = ctx.createLinearGradient(180, 140, 320, 380);
      textGrad.addColorStop(0, '#fef08a');
      textGrad.addColorStop(0.4, '#fb923c');
      textGrad.addColorStop(1, '#ef25cb');
      ctx.fillStyle = textGrad;
      ctx.fillText('?', 256, 256);

      // 5. 우측 상단 조그마한 주사위 넘버 핍 (1~6 눈금)
      ctx.font = '900 46px "Pretendard", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${diceNumber}`, 430, 84);

      const texture = new THREE.CanvasTexture(c);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    // 6개 면 재질 정의 (Three.js BoxGeometry: +X, -X, +Y, -Y, +Z, -Z)
    const diceMaterials = [
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(1, '#ef25cb'), roughness: 0.25, metalness: 0.15 }),
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(6, '#06b6d4'), roughness: 0.25, metalness: 0.15 }),
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(2, '#f43f5e'), roughness: 0.25, metalness: 0.15 }),
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(5, '#eab308'), roughness: 0.25, metalness: 0.15 }),
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(3, '#8b5cf6'), roughness: 0.25, metalness: 0.15 }),
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(4, '#10b981'), roughness: 0.25, metalness: 0.15 }),
    ];

    // 주사위 그룹 생성
    const diceGroup = new THREE.Group();
    diceScene.add(diceGroup);

    // 큼직하고 존재감 넘치는 3D 주사위 메쉬 (크기 2.7)
    const diceGeo = new THREE.BoxGeometry(2.7, 2.7, 2.7);
    const diceMesh = new THREE.Mesh(diceGeo, diceMaterials);
    diceGroup.add(diceMesh);

    // 외곽 엣지 와이어프레임 글로우 라인
    const edgesGeo = new THREE.EdgesGeometry(diceGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.55 });
    const diceEdges = new THREE.LineSegments(edgesGeo, edgesMat);
    diceMesh.add(diceEdges);

    // 바닥 네온 글로우 링
    const glowRingGeo = new THREE.RingGeometry(1.6, 2.5, 32);
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: 0xef25cb,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = -2.1;
    diceGroup.add(glowRing);

    // 눈금 1~6에 대응하는 타겟 회전 각도
    const faceRotations = {
      1: { x: 0.2, y: -Math.PI / 2 - 0.2 },
      2: { x: Math.PI / 2 - 0.2, y: 0.2 },
      3: { x: 0.25, y: -0.35 },
      4: { x: -0.25, y: Math.PI + 0.35 },
      5: { x: -Math.PI / 2 + 0.2, y: -0.2 },
      6: { x: 0.2, y: Math.PI / 2 + 0.2 },
    };

    let targetDiceRotX = 0.25;
    let targetDiceRotY = -0.35;
    let isRolling = false;
    let rollProgress = 1;
    let rollStartRotX = 0;
    let rollStartRotY = 0;
    let rollTargetRotX = 0;
    let rollTargetRotY = 0;

    // 마우스/터치 드래그 조작
    let isDiceDragging = false;
    let dicePrevX = 0;
    let dicePrevY = 0;
    let diceDragDelta = 0;

    luckyDiceCanvas.addEventListener('mousedown', (e) => {
      isDiceDragging = true;
      dicePrevX = e.clientX;
      dicePrevY = e.clientY;
      diceDragDelta = 0;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDiceDragging) return;
      const dx = e.clientX - dicePrevX;
      const dy = e.clientY - dicePrevY;
      diceDragDelta += Math.abs(dx) + Math.abs(dy);
      dicePrevX = e.clientX;
      dicePrevY = e.clientY;

      if (!isRolling) {
        diceMesh.rotation.y += dx * 0.015;
        diceMesh.rotation.x += dy * 0.015;
        targetDiceRotY = diceMesh.rotation.y;
        targetDiceRotX = diceMesh.rotation.x;
      }
    });

    window.addEventListener('mouseup', () => {
      if (!isDiceDragging) return;
      isDiceDragging = false;
      // 단순 클릭(드래그 거리 6px 미만)이면 주사위 굴리기 발동!
      if (diceDragDelta < 6 && !isRolling) {
        rollLuckyDice();
      }
    });

    // 모바일 터치 이벤트
    luckyDiceCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDiceDragging = true;
        dicePrevX = e.touches[0].clientX;
        dicePrevY = e.touches[0].clientY;
        diceDragDelta = 0;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDiceDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - dicePrevX;
      const dy = e.touches[0].clientY - dicePrevY;
      diceDragDelta += Math.abs(dx) + Math.abs(dy);
      dicePrevX = e.touches[0].clientX;
      dicePrevY = e.touches[0].clientY;

      if (!isRolling) {
        diceMesh.rotation.y += dx * 0.015;
        diceMesh.rotation.x += dy * 0.015;
        targetDiceRotY = diceMesh.rotation.y;
        targetDiceRotX = diceMesh.rotation.x;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (isDiceDragging) {
        isDiceDragging = false;
        if (diceDragDelta < 8 && !isRolling) {
          rollLuckyDice();
        }
      }
    });

    // 3D 주사위 굴리기 함수
    function rollLuckyDice() {
      if (isRolling) return;
      isRolling = true;
      rollProgress = 0;

      // 1~6 중 무작위 눈금 결정
      const randomDice = Math.floor(Math.random() * 6) + 1;
      const targetFacing = faceRotations[randomDice] || faceRotations[1];

      rollStartRotX = diceMesh.rotation.x;
      rollStartRotY = diceMesh.rotation.y;

      // 2~3회전 빠른 스핀
      const extraSpinX = (Math.PI * 2) * (1 + Math.floor(Math.random() * 2));
      const extraSpinY = (Math.PI * 2) * (2 + Math.floor(Math.random() * 2));

      rollTargetRotX = targetFacing.x + extraSpinX;
      rollTargetRotY = targetFacing.y + extraSpinY;

      // 눈금 안착 & 3D 보드판 및 하단 카드 전환
      setTimeout(() => {
        jumpToDiceTab(randomDice);
      }, 700);
    }

    // 외부에서 특정 눈금 선택 시 주사위 회전 동기화
    window.syncLuckyDiceFace = function (diceNum) {
      if (isRolling || isDiceDragging) return;
      const targetFacing = faceRotations[diceNum];
      if (targetFacing) {
        targetDiceRotX = targetFacing.x;
        targetDiceRotY = targetFacing.y;
      }
    };

    // 렌더 애니메이션 루프
    const diceClock = new THREE.Clock();

    function animateDice() {
      requestAnimationFrame(animateDice);
      const delta = diceClock.getDelta();
      const time = diceClock.getElapsedTime();

      // 1. 주사위 굴리기 애니메이션
      if (isRolling) {
        rollProgress += delta * 1.35;
        if (rollProgress >= 1) {
          rollProgress = 1;
          isRolling = false;
          targetDiceRotX = rollTargetRotX;
          targetDiceRotY = rollTargetRotY;
        }

        // cubic ease out
        const t = 1 - Math.pow(1 - rollProgress, 3);
        diceMesh.rotation.x = rollStartRotX + (rollTargetRotX - rollStartRotX) * t;
        diceMesh.rotation.y = rollStartRotY + (rollTargetRotY - rollStartRotY) * t;

        // 점프 포물선
        const hop = Math.sin(rollProgress * Math.PI) * 0.9;
        diceMesh.position.y = hop;
      } else if (!isDiceDragging) {
        // 아이들 부유 애니메이션 및 회전 감속
        diceMesh.rotation.x += (targetDiceRotX - diceMesh.rotation.x) * (delta * 4.5);
        diceMesh.rotation.y += (targetDiceRotY - diceMesh.rotation.y) * (delta * 4.5);
        diceMesh.position.y = Math.sin(time * 2.5) * 0.12;

        // 천천히 숨쉬는 부유 회전
        targetDiceRotY += delta * 0.22;
      }

      // 바닥 링 펄스
      glowRing.scale.setScalar(1 + Math.sin(time * 3) * 0.08);

      diceRenderer.render(diceScene, diceCamera);
    }

    animateDice();

    // 리사이즈 핸들러
    const handleDiceResize = () => {
      const container = document.getElementById('boardTopSlotArea') || luckyDiceCanvas.parentElement;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        diceCamera.aspect = w / h;
        diceCamera.updateProjectionMatrix();
        diceRenderer.setSize(w, h, false);
      }
    };

    window.addEventListener('resize', handleDiceResize);
    setTimeout(handleDiceResize, 200);
  }

  // --------------------------------------------------------------------------
  // 6. 트레일러 영상 모달 열기 / 닫기
  // --------------------------------------------------------------------------
  const videoModal = document.getElementById('trailerVideoModal') || document.querySelector('.video-modal-backdrop');
  const openTrailerBtns = document.querySelectorAll('.open-trailer-btn');
  const closeTrailerBtn = videoModal ? videoModal.querySelector('.video-modal-close') : null;
  const trailerIframe = videoModal ? videoModal.querySelector('#trailerIframe') : null;
  const officialTrailerSrc = trailerIframe?.getAttribute('data-src') || 'https://www.youtube-nocookie.com/embed/gvMz1hC8lWM?autoplay=1&enablejsapi=1';

  if (videoModal) {
    const openModal = (customSrc, customTitle) => {
      videoModal.classList.add('is-open');
      videoModal.setAttribute('aria-hidden', 'false');
      const titleEl = videoModal.querySelector('#trailerModalTitle');
      if (titleEl && customTitle) {
        titleEl.textContent = customTitle;
      } else if (titleEl) {
        titleEl.textContent = 'Astral Party 공식 게임플레이 트레일러';
      }
      // 트레일러 영상 로드 및 자동 재생 시작
      if (trailerIframe) {
        trailerIframe.setAttribute('src', customSrc || officialTrailerSrc);
      }
      lenis?.stop();
    };

    window.openVideoModal = openModal;

    const closeModal = () => {
      videoModal.classList.remove('is-open');
      videoModal.setAttribute('aria-hidden', 'true');
      // 모달 닫을 때 백그라운드에서 오디오가 계속 재생되는 현상 완벽 방지
      if (trailerIframe) {
        trailerIframe.setAttribute('src', '');
      }
      lenis?.start();
    };

    openTrailerBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    closeTrailerBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });

    videoModal.addEventListener('click', (e) => {
      if (e.target === videoModal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && videoModal.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  // --------------------------------------------------------------------------
  // [신규] 6-2. 환상의 기사 플로팅 버튼 및 이벤트 모달 인터랙션
  // --------------------------------------------------------------------------
  const floatingWidget = document.getElementById('astralFloatingWidget');
  const floatingBtn = document.getElementById('astralFloatingBtn');
  const floatingCloseBtn = document.getElementById('floatingWidgetClose');
  const floatingReopenChip = document.getElementById('floatingWidgetReopen');
  const knightModal = document.getElementById('knightEventModal');
  const knightCloseBtn = document.querySelector('.knight-modal-close');
  const knightJumpEventsBtn = document.querySelector('.knight-jump-events-btn');

  // 모달 열기 함수
  const openKnightModal = () => {
    if (knightModal) {
      knightModal.classList.add('is-open');
      knightModal.setAttribute('aria-hidden', 'false');
      lenis?.stop();
    }
  };

  // 모달 닫기 함수
  const closeKnightModal = () => {
    if (knightModal) {
      knightModal.classList.remove('is-open');
      knightModal.setAttribute('aria-hidden', 'true');
      lenis?.start();
    }
  };

  // 플로팅 버튼 클릭 시 모달 열기
  floatingBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openKnightModal();
  });

  // 플로팅 버튼 X 닫기 버튼 (화면에서 숨기고 우측 하단 복원 칩 표시)
  floatingCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    floatingWidget?.classList.add('is-hidden');
    floatingReopenChip?.classList.add('is-visible');
  });

  // 복원 칩 클릭 시 플로팅 버튼 다시 보이기
  floatingReopenChip?.addEventListener('click', () => {
    floatingWidget?.classList.remove('is-hidden');
    floatingReopenChip?.classList.remove('is-visible');
  });

  // 모달 닫기 버튼 및 배경 클릭 시 닫기
  knightCloseBtn?.addEventListener('click', closeKnightModal);
  knightModal?.addEventListener('click', (e) => {
    if (e.target === knightModal) {
      closeKnightModal();
    }
  });

  // ESC 키 누를 시 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && knightModal?.classList.contains('is-open')) {
      closeKnightModal();
    }
  });

  // 모달 내 '이벤트 슬라이더 보기' 버튼 클릭 시 모달 닫고 이벤트 섹션으로 부드럽게 이동
  knightJumpEventsBtn?.addEventListener('click', () => {
    closeKnightModal();
    const eventSection = document.getElementById('events');
    if (eventSection) {
      if (lenis) {
        lenis.scrollTo(eventSection, { offset: -70, duration: 1.2 });
      } else {
        eventSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });

  // --------------------------------------------------------------------------
  // [신규] 6-3. 플로팅 버튼 푸터 충돌 방지 (푸터 상단 20px 전에서 멈춤)
  // 유저 요청: 아래로 내릴 때 푸터 안쪽으로 들어가지 않고 푸터 윗부분 20px 전에서 멈추도록 처리
  // --------------------------------------------------------------------------
  const footerElement = document.querySelector('.site-footer');

  const updateFloatingWidgetPosition = () => {
    if (!footerElement) return;

    // 기기 너비에 따른 기본 bottom 위치 (데스크톱: 28px, 모바일: 18px)
    const isMobile = window.innerWidth <= 768;
    const defaultBottom = isMobile ? 18 : 28;
    const defaultReopenBottom = isMobile ? 14 : 24;
    const gapAboveFooter = 20; // 푸터 윗부분과 유지할 여백 20px

    // 뷰포트 기준 푸터 상단 좌표 및 뷰포트 전체 높이
    const footerRect = footerElement.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // 푸터 상단이 브라우저 하단 위로 올라온 높이
    const footerOverlap = windowHeight - footerRect.top;

    if (footerOverlap > 0) {
      // 푸터가 화면에 나타난 경우: 푸터 상단보다 정확히 20px 위에 위치하도록 bottom을 동적으로 밀어올림
      const clampedBottom = footerOverlap + gapAboveFooter;
      if (floatingWidget) {
        floatingWidget.style.bottom = `${clampedBottom}px`;
      }
      if (floatingReopenChip) {
        floatingReopenChip.style.bottom = `${clampedBottom}px`;
      }
    } else {
      // 푸터가 아직 화면 아래에 있는 일반 상태: 기본 bottom 유지
      if (floatingWidget) {
        floatingWidget.style.bottom = `${defaultBottom}px`;
      }
      if (floatingReopenChip) {
        floatingReopenChip.style.bottom = `${defaultReopenBottom}px`;
      }
    }
  };

  // Lenis 스크롤, 일반 윈도우 스크롤, 창 크기 변경 시 실시간 좌표 동기화
  if (lenis) {
    lenis.on('scroll', updateFloatingWidgetPosition);
  }
  window.addEventListener('scroll', updateFloatingWidgetPosition, { passive: true });
  window.addEventListener('resize', updateFloatingWidgetPosition);

  // 초기 위치 1회 즉시 계산
  updateFloatingWidgetPosition();

  // --------------------------------------------------------------------------
  // 7. 상단으로 이동 (Back to Top) 및 내비게이션 앵커 스크롤
  // --------------------------------------------------------------------------
  const backToTopBtn = document.querySelector('.back-to-top-btn');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(0, { duration: 1.4 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  const navAnchorLinks = document.querySelectorAll('a[href^="#"]');
  navAnchorLinks.forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          if (lenis) {
            lenis.scrollTo(targetElement, { offset: -80, duration: 1.2 });
          } else {
            targetElement.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 8. 모바일/태블릿 햄버거 메뉴 토글 & 웹접근성 (WCAG) 지원
  // --------------------------------------------------------------------------
  const mobileToggle = document.querySelector('.mobile-toggle');
  const siteNav = document.querySelector('.site-nav');

  if (mobileToggle && siteNav) {
    const toggleMenu = (forceState) => {
      const isOpen = typeof forceState === 'boolean' ? forceState : !siteNav.classList.contains('is-open');
      if (isOpen) {
        siteNav.classList.add('is-open');
        mobileToggle.classList.add('is-active');
        mobileToggle.setAttribute('aria-expanded', 'true');
        mobileToggle.setAttribute('aria-label', '전체 메뉴 닫기');
      } else {
        siteNav.classList.remove('is-open');
        mobileToggle.classList.remove('is-active');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-label', '전체 메뉴 열기');
      }
    };

    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    const mobileMenuLinks = document.querySelectorAll('.site-nav .nav-link');
    mobileMenuLinks.forEach((link) => {
      link.addEventListener('click', () => {
        toggleMenu(false);
      });
    });

    // 메뉴 바깥 클릭 시 자동 닫힘
    document.addEventListener('click', (e) => {
      if (siteNav.classList.contains('is-open') && !siteNav.contains(e.target) && !mobileToggle.contains(e.target)) {
        toggleMenu(false);
      }
    });

    // ESC 키 입력 시 닫기 및 포커스 복귀 (접근성)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && siteNav.classList.contains('is-open')) {
        toggleMenu(false);
        mobileToggle.focus();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 9. [신규 추가] 실제 인게임 미디어 갤러리 & 라이트박스 뷰어
  // --------------------------------------------------------------------------
  const galleryFilterBtns = document.querySelectorAll('.gallery-filter-btn');
  const galleryCards = document.querySelectorAll('.gallery-card-item');
  const photoCards = Array.from(document.querySelectorAll('.gallery-card-item.is-photo'));
  const videoCards = document.querySelectorAll('.gallery-card-item.is-video');

  // A. 필터 탭 클릭 핸들러 (All / Videos / Photos)
  galleryFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      galleryFilterBtns.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      const filterType = btn.getAttribute('data-filter') || 'all';
      galleryCards.forEach((card) => {
        const itemType = card.getAttribute('data-type');
        if (filterType === 'all' || itemType === filterType) {
          card.classList.remove('is-hidden');
        } else {
          card.classList.add('is-hidden');
        }
      });
    });
  });

  // B. 비디오 카드 클릭 시 스팀 공식 소개 트레일러(3W7FQrPCK3U) 모달 팝업 열기
  videoCards.forEach((videoCard) => {
    videoCard.addEventListener('click', (e) => {
      e.preventDefault();
      const videoSrc = videoCard.getAttribute('data-video-src') || 'https://www.youtube-nocookie.com/embed/3W7FQrPCK3U?autoplay=1&enablejsapi=1';
      const videoTitle = videoCard.getAttribute('data-video-title') || 'Astral Party 스팀 공식 소개 트레일러';
      if (typeof window.openVideoModal === 'function') {
        window.openVideoModal(videoSrc, videoTitle);
      }
    });
  });

  // C. 스크린샷 카드 클릭 시 라이트박스 팝업 열기 & 고화질 원본 탐색
  const galleryLightbox = document.getElementById('galleryLightbox');
  const lightboxImg = document.getElementById('galleryLightboxImg');
  const lightboxTitle = document.getElementById('galleryLightboxTitle');
  const lightboxDesc = document.getElementById('galleryLightboxDesc');
  const lightboxCounter = document.getElementById('galleryLightboxCounter');
  const lightboxCloseBtn = document.getElementById('galleryLightboxClose');
  const lightboxPrevBtn = document.getElementById('galleryLightboxPrev');
  const lightboxNextBtn = document.getElementById('galleryLightboxNext');

  let currentPhotoIndex = 0;

  const renderLightbox = (index) => {
    if (!photoCards.length) return;
    currentPhotoIndex = (index + photoCards.length) % photoCards.length;
    const card = photoCards[currentPhotoIndex];
    if (!card) return;

    const cardImgEl = card.querySelector('.gallery-card-img');
    const fullSrc = card.getAttribute('data-full-src') || cardImgEl?.getAttribute('src') || '';
    const title = card.getAttribute('data-title') || '인게임 스크린샷';
    const desc = card.getAttribute('data-desc') || '';

    if (lightboxImg && fullSrc) {
      lightboxImg.style.opacity = '0';
      setTimeout(() => {
        lightboxImg.src = fullSrc;
        lightboxImg.alt = title;
        lightboxImg.style.opacity = '1';
      }, 100);
    }

    if (lightboxTitle) lightboxTitle.textContent = title;
    if (lightboxDesc) lightboxDesc.textContent = desc;
    if (lightboxCounter) lightboxCounter.textContent = `${currentPhotoIndex + 1} / ${photoCards.length}`;
  };

  const openLightbox = (index) => {
    if (!galleryLightbox) return;
    renderLightbox(index);
    galleryLightbox.classList.add('is-open');
    galleryLightbox.setAttribute('aria-hidden', 'false');
    lenis?.stop();
  };

  const closeLightbox = () => {
    if (!galleryLightbox) return;
    galleryLightbox.classList.remove('is-open');
    galleryLightbox.setAttribute('aria-hidden', 'true');
    lenis?.start();
  };

  photoCards.forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(idx);
    });
  });

  lightboxCloseBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeLightbox();
  });

  lightboxPrevBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderLightbox(currentPhotoIndex - 1);
  });

  lightboxNextBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    renderLightbox(currentPhotoIndex + 1);
  });

  galleryLightbox?.addEventListener('click', (e) => {
    if (e.target === galleryLightbox) {
      closeLightbox();
    }
  });

  // 키보드 화살표 및 ESC 키 제어
  window.addEventListener('keydown', (e) => {
    if (!galleryLightbox || !galleryLightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      renderLightbox(currentPhotoIndex - 1);
    } else if (e.key === 'ArrowRight') {
      renderLightbox(currentPhotoIndex + 1);
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAstralParty);
} else {
  initAstralParty();
}
