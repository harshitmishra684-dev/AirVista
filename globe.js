/**
 * 3D Globe Module
 * Creates an interactive Earth globe using Three.js
 * Handles click-to-select locations and visual markers
 */

const Globe = (() => {
    let scene, camera, renderer, globe, atmosphere, markerGroup;
    let controls;
    let raycaster, mouse;
    let onLocationSelect = null;
    let stars;
    let pulseRings = [];
    let animationId = null;
    let labelsContainer;
    
    // Major world cities
    const MAJOR_CITIES = [
        { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
        { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
        { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
        { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
        { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
        { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
        { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
        { name: 'Beijing', lat: 39.9042, lng: 116.4074 },
        { name: 'Osaka', lat: 34.6937, lng: 135.5023 },
        { name: 'New York', lat: 40.7128, lng: -74.0060 },
        { name: 'London', lat: 51.5074, lng: -0.1278 },
        { name: 'Paris', lat: 48.8566, lng: 2.3522 },
        { name: 'Moscow', lat: 55.7558, lng: 37.6173 },
        { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
        { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
        { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
        { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
        { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
        { name: 'Seoul', lat: 37.5665, lng: 126.9780 },
        { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
        { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
        { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 }
    ];
    let cityElements = [];
    
    // Texture URLs
    const EARTH_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
    const BUMP_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-topology.png';
    const WATER_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-water.png';

    /**
     * Initialize the 3D Globe
     */
    function init(container, onSelect) {
        onLocationSelect = onSelect;

        // Scene
        scene = new THREE.Scene();

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        camera.position.z = 2.5;

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        // OrbitControls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false;
        controls.minDistance = 1.2;
        controls.maxDistance = 5;
        // Disable auto-rotate as per user request
        controls.autoRotate = false;

        // Raycaster for clicks
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // Marker group
        markerGroup = new THREE.Group();
        scene.add(markerGroup);

        labelsContainer = document.getElementById('labels-container');

        // Create scene elements
        createStarfield();
        createGlobe();
        createAtmosphere();
        createLighting();
        createCityLabels();

        // Event listeners
        setupEventListeners(container);

        // Start animation loop
        animate();

        // Handle resize
        window.addEventListener('resize', () => onResize(container));
    }

    /**
     * Create starfield background
     */
    function createStarfield() {
        const starsGeometry = new THREE.BufferGeometry();
        const starCount = 3000;
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            // Generate points on a sphere of radius 50 to keep them far away from the globe
            const r = 50;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = r * Math.cos(phi);
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1, // slightly larger since they are further away
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);
    }

    /**
     * Create the Earth globe with real high-res textures
     */
    function createGlobe() {
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        
        const textureLoader = new THREE.TextureLoader();
        textureLoader.crossOrigin = 'anonymous';
        
        const material = new THREE.MeshPhongMaterial({
            map: textureLoader.load(EARTH_TEXTURE),
            bumpMap: textureLoader.load(BUMP_TEXTURE),
            bumpScale: 0.015,
            specularMap: textureLoader.load(WATER_TEXTURE),
            specular: new THREE.Color('grey'),
            shininess: 15
        });

        globe = new THREE.Mesh(geometry, material);
        // Add the globe to a container group so we can rotate it if needed, or just add directly
        scene.add(globe);
    }

    /**
     * Create atmospheric glow effect
     */
    function createAtmosphere() {
        // Outer glow
        const atmosphereGeometry = new THREE.SphereGeometry(1.15, 64, 64);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(0.0, 0.83, 1.0, 1.0) * intensity * 0.6;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });

        atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        scene.add(atmosphere);
    }

    /**
     * Setup lighting
     */
    function createLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        // Directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(5, 3, 5);
        scene.add(sunLight);

        // Secondary light for fill
        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-3, -2, -3);
        scene.add(fillLight);
    }

    /**
     * Create HTML labels for major cities
     */
    function createCityLabels() {
        if (!labelsContainer) return;
        
        MAJOR_CITIES.forEach((city, index) => {
            // Convert lat/lng to 3D position
            const phi = (90 - city.lat) * Math.PI / 180;
            const theta = (city.lng + 180) * Math.PI / 180;
            const radius = 1.02; // Slightly above globe surface
            
            const position = new THREE.Vector3(
                -radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
            
            // Create DOM element
            const el = document.createElement('div');
            el.className = 'city-label';
            el.textContent = city.name;
            el.dataset.index = index;
            
            // Click event
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                focusOnLocation(city.lat, city.lng);
                if (onLocationSelect) {
                    onLocationSelect(city.lat, city.lng);
                }
            });
            
            labelsContainer.appendChild(el);
            
            cityElements.push({
                element: el,
                position: position,
                lat: city.lat,
                lng: city.lng
            });
        });
    }

    /**
     * Update 2D positions of city labels
     */
    function updateLabels() {
        if (!labelsContainer || cityElements.length === 0) return;
        
        const widthHalf = renderer.domElement.clientWidth / 2;
        const heightHalf = renderer.domElement.clientHeight / 2;
        
        // Get camera direction for visibility check
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        
        cityElements.forEach(city => {
            // Clone position as we will modify it
            const pos = city.position.clone();
            
            // Vector from center to city
            const cityNormal = pos.clone().normalize();
            
            // Check if city is behind the globe
            // If dot product is > 0, it means the normal and camera direction are generally in the same direction 
            // (i.e. pointing away from camera, meaning it's on the far side)
            // Or more accurately: dot product of vector from camera to point, and point normal
            const cameraToCity = pos.clone().sub(camera.position).normalize();
            const isVisible = cameraToCity.dot(cityNormal) < -0.15; // Slightly negative to hide near edges
            
            if (!isVisible) {
                city.element.style.opacity = '0';
                city.element.style.pointerEvents = 'none';
                return;
            }
            
            // Project 3D position to 2D screen coordinates
            pos.project(camera);
            
            // Check if it's within camera view frustum (z <= 1)
            if (pos.z > 1) {
                city.element.style.opacity = '0';
                city.element.style.pointerEvents = 'none';
                return;
            }
            
            // Convert to CSS coordinates
            const x = (pos.x * widthHalf) + widthHalf;
            const y = -(pos.y * heightHalf) + heightHalf;
            
            city.element.style.opacity = '1';
            city.element.style.pointerEvents = 'all';
            city.element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        });
    }

    /**
     * Setup mouse/touch event listeners
     */
    function setupEventListeners(container) {
        const canvas = renderer.domElement;
        
        let startPoint = { x: 0, y: 0 };
        let dragStartTime = 0;

        canvas.addEventListener('pointerdown', (e) => {
            startPoint = { x: e.clientX, y: e.clientY };
            dragStartTime = Date.now();
        });

        canvas.addEventListener('pointerup', (e) => {
            const dragTime = Date.now() - dragStartTime;
            
            // Calculate how far the pointer moved
            const deltaX = Math.abs(e.clientX - startPoint.x);
            const deltaY = Math.abs(e.clientY - startPoint.y);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // If it moved less than 5 pixels and took less than 300ms, it's a click!
            if (distance < 5 && dragTime < 300) {
                handleClick(e, container);
            }
        });
    }

    /**
     * Handle click on globe to get lat/lng
     */
    function handleClick(event, container) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(globe);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;

            // Convert 3D point to lat/lng
            const localPoint = globe.worldToLocal(point.clone());
            // localPoint is on a unit sphere (radius 1)
            const lat = 90 - (Math.acos(localPoint.y)) * 180 / Math.PI;
            
            // Reverse the placement math: x = -sin(phi)*cos(theta), z = sin(phi)*sin(theta)
            const theta = Math.atan2(localPoint.z, -localPoint.x);
            let lng = (theta * 180 / Math.PI) - 180;
            
            // Normalize lng to [-180, 180]
            if (lng < -180) lng += 360;
            if (lng > 180) lng -= 360;

            // Add visual marker
            addMarker(intersects[0].point, lat, lng);

            // Callback
            if (onLocationSelect) {
                onLocationSelect(lat, lng);
            }
        }
    }

    /**
     * Add a visual marker at the clicked point
     */
    function addMarker(worldPoint, lat, lng) {
        // Clear previous markers
        while (markerGroup.children.length > 0) {
            markerGroup.remove(markerGroup.children[0]);
        }
        pulseRings = [];

        // Convert lat/lng to 3D position on globe surface
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lng + 180) * Math.PI / 180;
        const radius = 1.01;

        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        // Main marker dot
        const dotGeometry = new THREE.SphereGeometry(0.015, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.set(x, y, z);
        markerGroup.add(dot);

        // Pulse rings
        for (let i = 0; i < 3; i++) {
            const ringGeometry = new THREE.RingGeometry(0.02, 0.025, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x00d4ff,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.set(x, y, z);

            // Orient ring to face outward from globe center
            ring.lookAt(0, 0, 0);

            ring.userData = { phase: i * 0.33, baseOpacity: 0.8 };
            markerGroup.add(ring);
            pulseRings.push(ring);
        }

        // Vertical beam
        const beamGeometry = new THREE.CylinderGeometry(0.002, 0.002, 0.15, 8);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.5
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);

        // Position and orient beam
        const direction = new THREE.Vector3(x, y, z).normalize();
        beam.position.set(
            x + direction.x * 0.075,
            y + direction.y * 0.075,
            z + direction.z * 0.075
        );

        // Align beam with direction from center
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        markerGroup.add(beam);
    }

    /**
     * Animation loop
     */
    function animate() {
        animationId = requestAnimationFrame(animate);

        controls.update(); // required if damping enabled

        // Animate pulse rings
        const time = Date.now() * 0.001;
        for (const ring of pulseRings) {
            const phase = ring.userData.phase;
            const t = ((time + phase * 3) % 2) / 2; // 0 to 1, repeating every 2 seconds
            const scale = 1 + t * 3;
            ring.scale.set(scale, scale, scale);
            ring.material.opacity = ring.userData.baseOpacity * (1 - t);
        }

        // Stars slow rotation
        if (stars) {
            stars.rotation.y += 0.0001;
            stars.rotation.x += 0.00005;
        }

        updateLabels();

        renderer.render(scene, camera);
    }

    /**
     * Handle window resize
     */
    function onResize(container) {
        if (!camera || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    /**
     * Zoom controls
     */
    function zoomIn() {
        if (camera) {
            const targetDistance = Math.max(controls.minDistance, camera.position.length() - 0.5);
            camera.position.setLength(targetDistance);
        }
    }

    function zoomOut() {
        if (camera) {
            const targetDistance = Math.min(controls.maxDistance, camera.position.length() + 0.5);
            camera.position.setLength(targetDistance);
        }
    }

    function resetView() {
        if (camera) {
            camera.position.set(0, 0, 2.5);
            controls.target.set(0, 0, 0);
        }
    }

    function toggleAutoRotate() {
        controls.autoRotate = !controls.autoRotate;
        return controls.autoRotate;
    }

    /**
     * Rotate camera to face specific lat/lng
     */
    function focusOnLocation(lat, lng) {
        // Convert lat/lng to 3D position
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lng + 180) * Math.PI / 180;
        
        // Calculate the target position on the sphere surface
        const targetX = -Math.sin(phi) * Math.cos(theta);
        const targetY = Math.cos(phi);
        const targetZ = Math.sin(phi) * Math.sin(theta);
        
        // Add a marker at that location
        addMarker(null, lat, lng);
        
        // Move camera to look at this position
        // We set the camera position to be the target position scaled by distance
        const currentDistance = camera.position.length();
        const targetDistance = Math.max(1.8, currentDistance); // Zoom in a bit if too far
        
        const startPos = camera.position.clone();
        const targetPos = new THREE.Vector3(targetX, targetY, targetZ).multiplyScalar(targetDistance);
        
        // Smooth animation of camera position
        const duration = 1000;
        const startTime = Date.now();
        
        function animateCamera() {
            const elapsed = Date.now() - startTime;
            const t = Math.min(1, elapsed / duration);
            
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - t, 3);
            
            // Slerp for smooth spherical interpolation
            camera.position.copy(startPos).lerp(targetPos, eased);
            camera.lookAt(0, 0, 0); // Always look at center
            
            if (t < 1) {
                requestAnimationFrame(animateCamera);
            }
        }
        
        animateCamera();
    }

    /**
     * Dispose of Three.js resources
     */
    function dispose() {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        if (renderer) {
            renderer.dispose();
        }
    }

    function clearMarkers() {
        while (markerGroup.children.length > 0) {
            markerGroup.remove(markerGroup.children[0]);
        }
        pulseRings = [];
    }

    return {
        init,
        zoomIn,
        zoomOut,
        resetView,
        toggleAutoRotate,
        focusOnLocation,
        addMarker,
        clearMarkers,
        dispose
    };
})();
