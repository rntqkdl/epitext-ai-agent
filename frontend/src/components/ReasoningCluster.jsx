import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const ReasoningCluster = ({ data, selectedChar, selectedReliability, height = 600 }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const renderCluster = () => {
      if (!svgRef.current || !containerRef.current) return;

      try {
        // 1. 초기화 - 모든 요소 제거 (버그 수정: 확실한 초기화)
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current);

        // 2. 컨테이너 너비 가져오기
        const containerWidth = containerRef.current.offsetWidth || 800;

        // 3. 마진 설정
        const margin = { top: 40, right: 100, bottom: 40, left: 80 };

        // 4. 사용 가능한 너비 계산 (컨테이너 너비 - 좌우 마진)
        const availableWidth = containerWidth - margin.left - margin.right;

        // 5. 각 섹션 너비 계산 (3등분)
        const sectionWidth = availableWidth / 3; // Image(0) -> Model(1) -> Leaf(2) -> Final(3) = 4개 구간, 3등분

        // 6. 높이 계산
        const leafCount = data.children?.reduce((sum, child) => sum + (child.children?.length || 0), 0) || 0;
        const dynamicHeight = Math.max(height, leafCount * 30 + 100);

        // 7. SVG 크기 설정 (100% 너비, 동적 높이)
        svg.attr("width", containerWidth).attr("height", dynamicHeight);

        // 8. 데이터 계층화
        const root = d3.hierarchy(data);
        const innerHeight = dynamicHeight - margin.top - margin.bottom;

        // 9. Cluster 레이아웃 (수직 위치만 계산)
        const cluster = d3
          .cluster()
          .size([innerHeight, availableWidth])
          .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

        cluster(root);

        // 10. ★★★ 핵심: 가로 위치(y)를 섹션 너비로 강제 재조정 ★★★
        root.each((d) => {
          d.y = d.depth * sectionWidth; // 0, sectionWidth, sectionWidth*2
        });

        // 11. 최종 노드 위치 계산 (3번째 섹션 끝 = 맨 오른쪽)
        const finalNodeX = 3 * sectionWidth; // 3번째 섹션 끝
        const finalNodeY = innerHeight / 2; // 수직 중앙

        // 12. 그리기 그룹 생성
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // 13. Transition 설정 (공통 애니메이션)
        const t = d3.transition().duration(600).ease(d3.easeCubicInOut);
        const linkDuration = 600; // 링크 애니메이션 지속 시간

        // 14. 링크 생성기
        const linkGenerator = d3
          .linkHorizontal()
          .x((d) => d.y)
          .y((d) => d.x);

        // 15. 선택된 경로 판별 함수
        const isPathToSelected = (link) => {
          if (!selectedChar) return false;
          const source = link.source;
          const target = link.target;
          if (source.data.type === "root" && target.data.type === "model") {
            return target.children?.some((child) => child.data.name === selectedChar) || false;
          }
          if (source.data.type === "model" && target.data.type === "leaf") {
            return target.data.name === selectedChar;
          }
          return false;
        };

        // 16. Leaf 노드들의 인덱스를 계산하여 순차적으로 나타나도록 함
        const leafIndices = new Map();
        root.leaves().forEach((leaf, idx) => {
          leafIndices.set(leaf, idx);
        });

        // 17. 기본 트리 링크 그리기 (애니메이션 적용)
        const linkPaths = g
          .append("g")
          .selectAll("path")
          .data(root.links())
          .join("path")
          .attr("d", linkGenerator)
          .attr("fill", "none")
          .attr("stroke", (d) => (isPathToSelected(d) ? "#344D64" : "#C0C5DC"))
          .attr("stroke-width", (d) => (isPathToSelected(d) ? 2.5 : 1));

        // 링크에 애니메이션 적용 (전체 트리가 순차적으로 나타나도록)

        linkPaths.each(function (d) {
          const path = d3.select(this);
          const isSelected = isPathToSelected(d);
          const sourceDepth = d.source.depth;
          const targetDepth = d.target.depth;

          let linkDelay = 0;
          if (sourceDepth === 0 && targetDepth === 1) {
            // Root -> Model 링크: delay 0-200ms (각 Model마다 100ms 간격)
            const modelIndex = d.target.data.name.includes("Vision") ? 0 : 1;
            linkDelay = 0 + modelIndex * 100;
          } else if (sourceDepth === 1 && targetDepth === 2) {
            // Model -> Leaf 링크: delay 400ms부터 시작, 각 Leaf마다 20ms 간격
            const leafIndex = leafIndices.get(d.target) || 0;
            linkDelay = 400 + leafIndex * 20;
          }

          if (isSelected) {
            // 선택된 경로: 그려지는 애니메이션 + opacity
            const totalLength = path.node().getTotalLength();
            path
              .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
              .attr("stroke-dashoffset", totalLength)
              .attr("opacity", 0)
              .transition()
              .delay(linkDelay)
              .duration(linkDuration)
              .ease(d3.easeCubicInOut)
              .attr("stroke-dashoffset", 0)
              .attr("opacity", 1);
          } else {
            // 선택되지 않은 경로: 그려지는 애니메이션 + opacity
            const totalLength = path.node().getTotalLength();
            const targetOpacity = selectedChar ? 0.1 : 0.4;
            path
              .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
              .attr("stroke-dashoffset", totalLength)
              .attr("opacity", 0)
              .transition()
              .delay(linkDelay)
              .duration(linkDuration)
              .ease(d3.easeCubicInOut)
              .attr("stroke-dashoffset", 0)
              .attr("opacity", targetOpacity);
          }
        });

        // 18. 최종 노드로 가는 링크 그리기 (selectedChar가 있을 때만, 애니메이션 적용)
        if (selectedChar) {
          const targetNodes = root.leaves().filter((d) => d.data.name === selectedChar);

          targetNodes.forEach((sourceNode) => {
            const linkData = {
              source: sourceNode,
              target: { x: finalNodeY, y: finalNodeX },
            };

            const finalLink = g
              .append("path")
              .attr("d", linkGenerator(linkData))
              .attr("fill", "none")
              .attr("stroke", "#344D64")
              .attr("stroke-width", 2.5)
              .attr("opacity", 0); // 초기 투명

            // 그려지는 애니메이션 적용 (Leaf->Final은 depth 2이므로 delay 600ms)
            const totalLength = finalLink.node().getTotalLength();
            finalLink
              .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
              .attr("stroke-dashoffset", totalLength)
              .transition()
              .delay(600) // Model->Leaf 링크가 끝난 후 시작
              .duration(linkDuration)
              .ease(d3.easeCubicInOut)
              .attr("stroke-dashoffset", 0)
              .attr("opacity", 1);
          });
        }

        // 19. 노드 그리기
        const nodeGroup = g
          .append("g")
          .selectAll("g")
          .data(root.descendants())
          .join("g")
          .attr("transform", (d) => `translate(${d.y},${d.x})`);

        // 20. 각 노드 타입별 렌더링 (애니메이션 적용)
        nodeGroup.each(function (d) {
          const node = d3.select(this);
          const type = d.data.type;
          const isSelected = type === "leaf" && d.data.name === selectedChar;
          const isOnSelectedPath =
            selectedChar && (type === "model" ? d.children?.some((child) => child.data.name === selectedChar) : false);

          if (type === "root") {
            // Root Node Styling (delay 0, 즉시 나타남)
            const rootCircle = node.append("circle").attr("r", 24).attr("fill", "#f5f5f5").attr("stroke", "#ccc").attr("opacity", 0);
            rootCircle.transition().delay(0).duration(300).ease(d3.easeCubicInOut).attr("opacity", 1);

            if (d.data.imgUrl) {
              // 크롭된 탁본 이미지 표시
              const imageGroup = node.append("g").attr("opacity", 0);
              const clipPath = svg
                .append("defs")
                .append("clipPath")
                .attr("id", `clip-${d.data.id || "root"}`);
              clipPath.append("circle").attr("r", 24);

              imageGroup
                .append("image")
                .attr("href", d.data.imgUrl)
                .attr("x", -24)
                .attr("y", -24)
                .attr("width", 48)
                .attr("height", 48)
                .attr("clip-path", `url(#clip-${d.data.id || "root"})`)
                .attr("preserveAspectRatio", "xMidYMid slice");

              imageGroup.transition().delay(0).duration(300).ease(d3.easeCubicInOut).attr("opacity", 1);
            } else {
              // 이미지가 없을 때 "IMG" 텍스트 표시
              const rootText = node
                .append("text")
                .attr("dy", 4)
                .attr("text-anchor", "middle")
                .text("IMG")
                .attr("font-size", 10)
                .attr("fill", "#999")
                .attr("opacity", 0);
              rootText.transition().delay(0).duration(300).ease(d3.easeCubicInOut).attr("opacity", 1);
            }
          } else if (type === "model") {
            // Model Node Styling (Root->Model 링크 후 나타남)
            const modelIndex = d.data.name.includes("Vision") ? 0 : 1;
            const modelDelay = 200 + modelIndex * 100; // Root->Model 링크 후 나타남

            const modelCircle = node.append("circle").attr("r", 5).attr("fill", "#344D64").attr("opacity", 0);
            modelCircle.transition().delay(modelDelay).duration(300).ease(d3.easeCubicInOut).attr("opacity", 1);

            // Vision은 "획 일치도", NLP는 "문맥 일치도"로 표시
            const labelText = d.data.name.includes("Vision") ? "획 일치도" : "문맥 일치도";

            // 첫 번째 텍스트 (Halo 역할 - 배경 가림용, 애니메이션 적용)
            const haloText = node
              .append("text")
              .attr("x", 0)
              .attr("dy", -15)
              .attr("text-anchor", "middle")
              .text(labelText)
              .attr("font-size", 14)
              .attr("stroke", "white")
              .attr("stroke-width", "4px")
              .attr("stroke-linejoin", "round")
              .attr("stroke-linecap", "round")
              .attr("fill", "white")
              .attr("opacity", 0); // 초기 투명

            // Halo 텍스트가 서서히 나타나도록 애니메이션
            haloText.transition().delay(modelDelay).duration(300).ease(d3.easeCubicInOut).attr("opacity", 1);

            // 두 번째 텍스트 (실제 글자)
            const actualText = node
              .append("text")
              .attr("x", 0)
              .attr("dy", -15)
              .attr("text-anchor", "middle")
              .text(labelText)
              .attr("font-size", 14)
              .attr("font-weight", "600")
              .attr("fill", "#484a64")
              .attr("opacity", 0);

            actualText.transition().delay(modelDelay).duration(300).ease(d3.easeCubicInOut).attr("opacity", 1);
          } else if (type === "leaf") {
            // Leaf Node Styling (Model->Leaf 링크 후 순차적으로 나타남)
            const leafIndex = leafIndices.get(d) || 0;
            const leafDelay = 400 + leafIndex * 20; // Model->Leaf 링크 후 순차적으로

            const leafCircle = node.append("circle");
            leafCircle.attr("r", 3).attr("fill", "#999").attr("opacity", 0);

            // 선택된 노드에 애니메이션 적용
            if (isSelected) {
              leafCircle
                .transition()
                .delay(leafDelay)
                .duration(300)
                .ease(d3.easeCubicInOut)
                .attr("r", 5)
                .attr("fill", "#344D64")
                .attr("opacity", 1);
            } else {
              leafCircle
                .transition()
                .delay(leafDelay)
                .duration(300)
                .ease(d3.easeCubicInOut)
                .attr("opacity", selectedChar ? 0.3 : 0.6);
            }

            const labelText = `${d.data.name} ${(d.data.score * 100).toFixed(1)}%`;

            // 첫 번째 텍스트 (Halo 역할 - 배경 가림용, 애니메이션 적용)
            const haloText = node
              .append("text")
              .attr("x", 12)
              .attr("dy", 4)
              .attr("text-anchor", "start")
              .text(labelText)
              .attr("font-size", 14)
              .attr("stroke", "white")
              .attr("stroke-width", "4px")
              .attr("stroke-linejoin", "round")
              .attr("stroke-linecap", "round")
              .attr("fill", "white")
              .attr("opacity", 0); // 초기 투명

            // Halo 텍스트가 서서히 나타나도록 애니메이션
            haloText.transition().delay(leafDelay).duration(300).ease(d3.easeCubicInOut).attr("opacity", 1);

            // 두 번째 텍스트 (실제 글자, 애니메이션 적용)
            const actualText = node
              .append("text")
              .attr("x", 12)
              .attr("dy", 4)
              .attr("text-anchor", "start")
              .text(labelText)
              .attr("font-size", 14)
              .attr("fill", isSelected ? "#000" : "#888")
              .attr("font-weight", isSelected ? "bold" : "normal")
              .attr("opacity", 0);

            // 텍스트가 서서히 나타나도록 애니메이션
            actualText
              .transition()
              .delay(leafDelay)
              .duration(300)
              .ease(d3.easeCubicInOut)
              .attr("opacity", isSelected ? 1 : selectedChar ? 0.3 : 1);
          }
        });

        // 21. 최종 노드 그리기 (selectedChar가 있을 때만, 애니메이션 적용)
        if (selectedChar) {
          const finalGroup = g.append("g").attr("transform", `translate(${finalNodeX}, ${finalNodeY})`).attr("opacity", 0); // 초기 투명 상태

          // 큰 원
          finalGroup
            .append("circle")
            .attr("r", 32)
            .attr("fill", "#344D64")
            .attr("stroke", "#fff")
            .attr("stroke-width", 3)
            .attr("filter", "drop-shadow(0px 3px 3px rgba(0,0,0,0.2))");

          // 글자
          finalGroup
            .append("text")
            .attr("dy", -2)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", 20)
            .attr("font-weight", "bold")
            .text(selectedChar);

          // 신뢰도 (있다면)
          if (selectedReliability) {
            finalGroup
              .append("text")
              .attr("dy", 16)
              .attr("text-anchor", "middle")
              .attr("fill", "rgba(255,255,255,0.8)")
              .attr("font-size", 11)
              .text(selectedReliability);
          }

          // 라벨 (노드 위쪽에 위치)
          finalGroup
            .append("text")
            .attr("x", 0)
            .attr("dy", -40)
            .attr("text-anchor", "middle")
            .attr("fill", "#344D64")
            .attr("font-weight", "bold")
            .attr("font-size", 14)
            .text("최종 신뢰도");

          // 링크 애니메이션이 끝날 때쯤 서서히 나타나도록 (Leaf->Final 링크가 끝난 후, delay 1200ms)
          finalGroup
            .transition()
            .delay(1200) // Root->Model(0-600ms) + Model->Leaf(300-900ms) + Leaf->Final(600-1200ms) 후
            .duration(500)
            .ease(d3.easeCubicInOut)
            .attr("opacity", 1);
        }
      } catch (error) {
        console.error("ReasoningCluster rendering error:", error);
      }
    };

    // 초기 렌더링
    renderCluster();

    // ResizeObserver로 컨테이너 크기 변경 감지
    const resizeObserver = new ResizeObserver(() => {
      renderCluster();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [data, selectedChar, selectedReliability, height]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-x-hidden overflow-y-hidden bg-white rounded-lg">
      <svg ref={svgRef} style={{ width: "100%", height: "100%", minHeight: height }} />
    </div>
  );
};

export default ReasoningCluster;
