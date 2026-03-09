<template>
  <div class="flow-background">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationId = 0;

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let time = 0;

  const handleResize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  };

  handleResize();
  window.addEventListener('resize', handleResize);

  const particles = Array.from({ length: 150 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    size: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.4 + 0.1,
  }));

  /**
   * 绘制中心区域的流动波纹
   * 通过叠加多组正弦曲线，保持背景具备连续的流线感
   */
  const drawWaves = () => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const mainWaveColor = isDark ? '51, 118, 205' : '51, 118, 205';
    const subWaveColor = isDark ? '204, 204, 204' : '60, 60, 67';

    const lines = 4;
    for (let i = 0; i < lines; i++) {
      ctx.beginPath();

      const isMain = i === 0;
      ctx.lineWidth = isMain ? 2 : 1;
      const alpha = isMain ? 0.25 : 0.08;
      ctx.strokeStyle = `rgba(${isMain ? mainWaveColor : subWaveColor}, ${alpha})`;

      for (let x = 0; x <= width; x += 10) {
        const yOffset = height / 2;

        // 叠加不同频率的波形，避免曲线过于单调
        const y1 = Math.sin((x * 0.003) + time + i * 1.5) * (height * 0.2);
        const y2 = Math.sin((x * 0.006) - time * 1.2 + i * 0.8) * (height * 0.15);
        const y3 = Math.sin((x * 0.01) + time * 0.8 + Math.PI * i) * (height * 0.05);

        const y = yOffset + y1 + y2 + y3;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  };

  /**
   * 绘制缓慢漂浮的粒子层
   * 粒子会持续向上漂移，并在越界后回到画布另一侧
   */
  const drawParticles = () => {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const dotColor = isDark ? '255, 255, 255' : '0, 0, 0';

    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy - 0.1;

      if (particle.x < 0) particle.x = width;
      if (particle.x > width) particle.x = 0;
      if (particle.y < 0) particle.y = height;
      if (particle.y > height) particle.y = 0;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${dotColor}, ${particle.alpha})`;
      ctx.fill();
    });
  };

  /**
   * 驱动背景动画帧循环
   */
  const render = () => {
    time += 0.002;
    ctx.clearRect(0, 0, width, height);

    drawWaves();
    drawParticles();

    animationId = requestAnimationFrame(render);
  };

  render();

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    cancelAnimationFrame(animationId);
  });
});
</script>

<style scoped>
.flow-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

canvas {
  width: 100%;
  height: 100%;
}
</style>
