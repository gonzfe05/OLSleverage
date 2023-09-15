function computeHatMatrix(X) {
  const XT = math.transpose(X);
  const XTX = math.multiply(XT, X);
  const XTX_inv = math.inv(XTX);
  const H = math.multiply(X, math.multiply(XTX_inv, XT));
  return H;
}

function computeOLSResiduals(X, y, slope, intercept) {
  const yHat = math.add(math.multiply(X, slope), intercept);
  const residuals = math.subtract(y, yHat);
  return residuals;
}

function computeLeverage(residualWith, residualWithout) {
  const leverage =
    1 - (residualWith * residualWith) / (residualWithout * residualWithout);
  return leverage;
}

function computeBeta(X, y) {
  const XT = math.transpose(X);
  const XTX = math.multiply(XT, X);
  const XTX_inv = math.inv(XTX);
  const beta = math.multiply(math.multiply(XTX_inv, XT), y);
  return beta;
}

function getLm(x, y) {
  X = x.map((val) => [1, val]);
  const hat = computeHatMatrix(X);
  const beta = computeBeta(X, y);
  const slope = beta[1];
  const intercept = beta[0];
  return { slope, intercept, hat };
}

const mean = (arr) => arr.reduce((acc, val) => acc + val, 0) / arr.length;

async function getData() {
  const dataset = await d3.json("./my_weather_data.json");
  const xAccessor = (d) => d.dewPoint;
  const yAccessor = (d) => d.humidity;
  // sample 100 points
  dataset.splice(10);

  return { dataset, xAccessor, yAccessor };
}

function getModel(dataset, xAccessor, yAccessor) {
  const xMean = mean(dataset.map(xAccessor));
  const { slope, intercept, hat } = getLm(
    dataset.map(xAccessor),
    dataset.map(yAccessor)
  );
  return { slope, intercept, xMean, hat };
}

async function getInputs() {
  const { dataset, xAccessor, yAccessor } = await getData();
  const { slope, intercept, xMean, hat } = getModel(
    dataset,
    xAccessor,
    yAccessor
  );
  return {
    data: {
      x: dataset.map(xAccessor),
      y: dataset.map(yAccessor),
      index: dataset.map((d, i) => i),
    },
    lm: {
      slope: slope,
      intercept: intercept,
    },
    xMean: xMean,
    hat: hat,
  };
}

function getDimensions() {
  const width = d3.min([window.innerWidth * 0.9, window.innerHeight * 0.9]);
  let dimensions = {
    width: width,
    height: width,
    margin: {
      top: 10,
      right: 10,
      bottom: 50,
      left: 50,
    },
  };
  dimensions.boundedWidth =
    dimensions.width - dimensions.margin.left - dimensions.margin.right;
  dimensions.boundedHeight =
    dimensions.height - dimensions.margin.top - dimensions.margin.bottom;
  return dimensions;
}

function drawCanvas(elementId, dimensions) {
  const wrapper = d3
    .select(elementId)
    .append("svg")
    .attr("width", dimensions.width)
    .attr("height", dimensions.height);
  const bounds = wrapper
    .append("g")
    .style(
      "transform",
      `translate(${dimensions.margin.left}px, ${dimensions.margin.top}px)`
    );
  return { wrapper, bounds };
}

function getScales(data, dimensions) {
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(data.x))
    .range([0, dimensions.boundedWidth])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(data.y))
    .range([dimensions.boundedHeight, 0])
    .nice();
  const colScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1]);
  return { xScale, yScale, colScale };
}

function drawLine(bounds, className, x1, x2, y1, y2, color, width) {
  console.log(className, x1, x2, y1, y2);
  bounds
    .append("line")
    .attr("class", className)
    .attr("x1", x1)
    .attr("y1", y1)
    .attr("x2", x2)
    .attr("y2", y2)
    .style("stroke", color)
    .style("stroke-dasharray", width);
}

function drawCircles(bounds, data, xScale, yScale, hat, colScale) {
  const color = hat.map((d, i) => d[i]);

  const dots = bounds.selectAll("circle").data(data.index);
  const newDots = dots.enter().append("circle");
  const allDots = newDots
    .merge(dots)
    .attr("cx", (d) => xScale(data.x[d]))
    .attr("cy", (d) => yScale(data.y[d]))
    .attr("r", 6)
    .style("fill", (d) => colScale(color[d]))
    .style("stroke", "black");
  const oldDots = dots.exit().remove();
}

function drawxDevianceLines(bounds, data, xScale, yScale, xMean) {
  const lines = bounds.selectAll("#xDevianceLine").data(data.index);
  const newLines = lines
    .enter()
    .append("line")
    .attr("id", (d) => `xDevianceLine-${d}`);
  const allLines = newLines
    .merge(lines)
    .attr("x1", (d) => xScale(data.x[d]))
    .attr("y1", (d) => yScale(data.y[d]))
    .attr("x2", (d) => xScale(xMean))
    .attr("y2", (d) => yScale(data.y[d]))
    .attr("stroke", "red")
    .style("stroke-dasharray", "5,5")
    .style("stroke-width", 0.5)
    .style("opacity", 0);
  const oldLines = lines.exit().remove();
}

function drawresidualLines(bounds, data, xScale, yScale, lm) {
  const lines = bounds.selectAll("#residualLine").data(data.index);
  const newLines = lines
    .enter()
    .append("line")
    .attr("id", (d) => `residualLine-${d}`);
  const allLines = newLines
    .merge(lines)
    .attr("x1", (d) => xScale(data.x[d]))
    .attr("y1", (d) => yScale(data.y[d]))
    .attr("x2", (d) => xScale(data.x[d]))
    .attr("y2", (d) => yScale(lm.slope * data.x[d] + lm.intercept))
    .attr("stroke", "blue")
    .style("stroke-dasharray", "5,5")
    .style("stroke-width", 0.5)
    .style("opacity", 0);
  const oldLines = lines.exit().remove();
}

formatDistance = d3.format(".2f");
function findMiddlePoint(x1, x2) {
  min = Math.min(x1, x2);
  max = Math.max(x1, x2);
  return min + (max - min) / 2;
}

function drawxDevianceText(bounds, data, xScale, yScale, xMean) {
  const text = bounds.selectAll("xDevianceText").data(data.index);
  const newText = text
    .enter()
    .append("text")
    .attr("id", (d) => `xDevianceText-${d}`);
  const allText = newText
    .merge(text)
    .attr("x", (d) => findMiddlePoint(xScale(data.x[d]), xScale(xMean)))
    .attr("y", (d) => yScale(data.y[d]) - 10)
    .text((d, i) => formatDistance(xMean - data.x[d]))
    .attr("font-family", "sans-serif")
    .attr("font-size", "11px")
    .attr("fill", "black")
    .style("opacity", 0);
  const oldText = text.exit().remove();
}

function drawResidualText(bounds, data, xScale, yScale, lm) {
  const text = bounds.selectAll("residualText").data(data.index);
  const newText = text
    .enter()
    .append("text")
    .attr("id", (d) => `residualText-${d}`);
  const allText = newText
    .merge(text)
    .attr("x", (d) => xScale(data.x[d]) + 10)
    .attr("y", (d) =>
      findMiddlePoint(
        yScale(data.y[d]),
        yScale(lm.slope * data.x[d] + lm.intercept)
      )
    )
    .text((d) =>
      formatDistance(lm.slope * data.x[d] + lm.intercept - data.y[d])
    )
    .attr("font-family", "sans-serif")
    .attr("font-size", "11px")
    .attr("fill", "black")
    .style("opacity", 0);
  const oldText = text.exit().remove();
}

function drawData(data, bounds, xMean, xScale, yScale, lm, hat, colScale) {
  drawLine(
    bounds,
    "meanLine",
    xScale(xMean),
    xScale(xMean),
    yScale(yScale.domain()[0]),
    yScale(yScale.domain()[1]),
    "black",
    "5,5"
  );
  drawLine(
    bounds,
    "regLine",
    xScale(xScale.domain()[0]),
    xScale(xScale.domain()[1]),
    yScale(lm.slope * xScale.domain()[0] + lm.intercept),
    yScale(lm.slope * xScale.domain()[1] + lm.intercept),
    "blue",
    2
  );
  drawCircles(bounds, data, xScale, yScale, hat, colScale);
  drawxDevianceLines(bounds, data, xScale, yScale, xMean);
  drawresidualLines(bounds, data, xScale, yScale, lm);
  drawxDevianceText(bounds, data, xScale, yScale, xMean);
  drawResidualText(bounds, data, xScale, yScale, lm);
}

function drawAxes(bounds, dimensions, xScale, yScale) {
  const xAxisGenerator = d3.axisBottom().scale(xScale);

  const xAxis = bounds
    .append("g")
    .call(xAxisGenerator)
    .style("transform", `translateY(${dimensions.boundedHeight}px)`);
  const xAxisLabel = xAxis
    .append("text")
    .attr("class", "x-axis-label")
    .attr("x", dimensions.boundedWidth / 2)
    .attr("y", dimensions.margin.bottom - 10)
    .html("dew point (&deg;F)");

  const yAxisGenerator = d3.axisLeft().scale(yScale).ticks(4);
  const yAxis = bounds.append("g").call(yAxisGenerator);

  const yAxisLabel = yAxis
    .append("text")
    .attr("class", "y-axis-label")
    .attr("x", -dimensions.boundedHeight / 2)
    .attr("y", -dimensions.margin.left + 10)
    .text("relative humidity");
}

function getDragCircleInteraction(
  bounds,
  data,
  xScale,
  yScale,
  colScale,
  xMean,
  lm,
  hat
) {
  function start(event, d) {
    draggedCircle = d3.select(this);
    initialPosition = { x: d3.event.x, y: d3.event.y };
    // Show horizontal distance to the mean
    draggedxDevianceLine = d3.select(`#xDevianceLine-${d}`);
    draggedxDevianceLine.style("opacity", 1);
    draggedxDevianceText = d3.select(`#xDevianceText-${d}`);
    draggedxDevianceText.style("opacity", 1);
    // Show vertical distance to the regression line
    draggedresidualLine = d3.select(`#residualLine-${d}`);
    draggedresidualLine.style("opacity", 1);
    draggedresidualText = d3.select(`#residualText-${d}`);
    draggedresidualText.style("opacity", 1);
    // Show pivot regression line
    pivotLm = getLm(
      data.x.filter((val, i) => i !== d),
      data.y.filter((val, i) => i !== d)
    );
    drawLine(
      bounds,
      "regLineOriginal",
      xScale(xScale.domain()[0]),
      xScale(xScale.domain()[1]),
      yScale(pivotLm.slope * xScale.domain()[0] + pivotLm.intercept),
      yScale(pivotLm.slope * xScale.domain()[1] + pivotLm.intercept),
      "red",
      2
    );
    // Show difference between regression lines
    drawLine(
      bounds,
      "regsDiffLine",
      initialPosition.x,
      initialPosition.x,
      yScale(lm.slope * xScale.invert(initialPosition.x) + lm.intercept),
      yScale(
        pivotLm.slope * xScale.invert(initialPosition.x) + pivotLm.intercept
      ),
      "green",
      2
    );
    // Show text with difference between regression lines
    const yHatNew = lm.slope * xScale.invert(initialPosition.x) + lm.intercept;
    const yHatPivot =
      pivotLm.slope * xScale.invert(initialPosition.x) + pivotLm.intercept;
    bounds
      .append("text")
      .attr("id", "regsDiffText")
      .attr("x", initialPosition.x + 10)
      .attr("y", findMiddlePoint(yScale(yHatNew), yScale(yHatPivot)))
      .text(formatDistance(yHatPivot - yHatNew))
      .attr("font-family", "sans-serif")
      .attr("font-size", "11px")
      .attr("fill", "black")
      .style("opacity", 1);
    // Show residual and leverage text
    const residualWith = computeOLSResiduals(
      data.x,
      data.y,
      lm.slope,
      lm.intercept
    )[d];
    const residualWithout = computeOLSResiduals(
      data.x,
      data.y,
      pivotLm.slope,
      pivotLm.intercept
    )[d];
    const leverage = computeLeverage(residualWith, residualWithout);
    bounds
      .append("text")
      .attr("font-family", "sans-serif")
      .attr("font-size", "11px")
      .attr("fill", "black")
      .style("opacity", 1)
      .attr("id", "residualText")
      .attr("x", 10)
      .attr("y", 10)
      .text(`Residual with selected data: ${formatDistance(residualWith)}`)
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(
        `Residual without selected data: ${formatDistance(residualWithout)}`
      )
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(
        `1 - (${formatDistance(residualWith)}/${formatDistance(
          residualWithout
        )}): ${formatDistance(leverage)}`
      )
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(`Hat matrix diagonal: ${formatDistance(hat[d][d])}`)
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(
        `Slope relative change: ${formatDistance(
          (pivotLm.slope - lm.slope) / lm.slope
        )}`
      );
  }

  function drag(event, d) {
    // Move the circle, move the mean, update the distance to it and recomput the regression line
    const newPosition = {
      x: d3.event.x,
      y: d3.event.y,
    };
    draggedCircle.attr("cx", newPosition.x).attr("cy", newPosition.y);

    // Compute new data
    const x = Array.from(data.x);
    const y = Array.from(data.y);
    x[d] = xScale.invert(newPosition.x);
    y[d] = yScale.invert(newPosition.y);
    const xNewMean = mean(x);
    const newLm = getLm(x, y);
    const slope = newLm.slope;
    const intercept = newLm.intercept;
    const newHat = newLm.hat;
    const yHatNew = slope * xScale.invert(newPosition.x) + intercept;
    const yHatPivot =
      pivotLm.slope * xScale.invert(newPosition.x) + pivotLm.intercept;

    // Move mean
    d3.select(".meanLine")
      .attr("x1", xScale(xNewMean))
      .attr("x2", xScale(xNewMean));
    // Move horizontal line
    draggedxDevianceLine
      .attr("y1", newPosition.y)
      .attr("y2", newPosition.y)
      .attr("x1", newPosition.x)
      .attr("x2", xScale(xNewMean));
    draggedxDevianceText
      .attr("x", findMiddlePoint(newPosition.x, xScale(xNewMean)))
      .attr("y", newPosition.y - 10)
      .text(formatDistance(xNewMean - xScale.invert(newPosition.x)));
    // compute new regression line
    d3.select(".regLine")
      .attr("y1", yScale(slope * xScale.domain()[0] + intercept))
      .attr("y2", yScale(slope * xScale.domain()[1] + intercept));
    // Move vertical line
    draggedresidualLine
      .attr("x1", newPosition.x)
      .attr("x2", newPosition.x)
      .attr("y1", newPosition.y)
      .attr("y2", yScale(slope * xScale.invert(newPosition.x) + intercept));
    // Move vertical text
    draggedresidualText
      .attr("x", newPosition.x + 10)
      .attr("y", findMiddlePoint(newPosition.y, yScale(yHatNew)))
      .text(formatDistance(yHatNew - yScale.invert(newPosition.y)));
    // Move regressions difference line
    d3.select(".regsDiffLine")
      .attr("x1", newPosition.x)
      .attr("x2", newPosition.x)
      .attr("y1", yScale(yHatPivot))
      .attr("y2", yScale(yHatNew));
    // Move regressions difference text
    d3.select("#regsDiffText")
      .attr("x", newPosition.x + 10)
      .attr("y", findMiddlePoint(yScale(yHatNew), yScale(yHatPivot)))
      .text(formatDistance(yHatPivot - yHatNew));
    // Move residual and leverage text
    const residualWith = computeOLSResiduals(x, y, slope, intercept)[d];
    const residualWithout = computeOLSResiduals(
      x,
      y,
      pivotLm.slope,
      pivotLm.intercept
    )[d];
    const leverage = computeLeverage(residualWith, residualWithout);
    d3.select("#residualText")
      .attr("x", 10)
      .attr("y", 10)
      .text(`Residual with selected data: ${formatDistance(residualWith)}`)
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(
        `Residual without selected data: ${formatDistance(residualWithout)}`
      )
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(
        `1 - (${formatDistance(residualWith)}/${formatDistance(
          residualWithout
        )}): ${formatDistance(leverage)}`
      )
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(`Hat matrix diagonal: ${formatDistance(newHat[d][d])}`)
      .append("tspan")
      .attr("x", 10)
      .attr("dy", 15)
      .text(
        `Slope relative change: ${formatDistance(
          (pivotLm.slope - slope) / slope
        )}`
      );
    // Update color of the circle
    const color = newHat.map((d, i) => d[i]);
    draggedCircle.style("fill", colScale(color[d]));
  }

  function end() {
    // Clear the dragged circle reference
    draggedCircle
      .transition()
      .attr("cx", initialPosition.x)
      .attr("cy", initialPosition.y);
    // Reset the mean line
    d3.select(".meanLine")
      .transition()
      .attr("x1", xScale(xMean))
      .attr("x2", xScale(xMean));
    // Reset the line
    draggedxDevianceLine
      .style("opacity", 0)
      .attr("y1", initialPosition.y)
      .attr("y2", initialPosition.y)
      .attr("x1", xScale(xMean))
      .attr("x2", initialPosition.x);
    // Reset the text
    draggedxDevianceText
      .style("opacity", 0)
      .attr("x", findMiddlePoint(xScale(xMean), initialPosition.x))
      .attr("y", initialPosition.y)
      .text(formatDistance(xMean - xScale.invert(initialPosition.x)));
    // Reset the regression line
    const { slope, intercept } = getLm(data.x, data.y);
    d3.select(".regLine")
      .transition()
      .attr("y1", yScale(slope * xScale.domain()[0] + intercept))
      .attr("y2", yScale(slope * xScale.domain()[1] + intercept));
    // Reset the vertical line
    yHatNew = slope * xScale.invert(initialPosition.x) + intercept;
    draggedresidualLine
      .style("opacity", 0)
      .attr("x1", initialPosition.x)
      .attr("x2", initialPosition.x)
      .attr("y1", initialPosition.y)
      .attr("y2", yScale(yHatNew));
    // Reset the vertical text
    draggedresidualText
      .style("opacity", 0)
      .attr("x", initialPosition.x + 10)
      .attr("y", findMiddlePoint(initialPosition.y, yScale(yHatNew)))
      .text(formatDistance(yHatNew - yScale.invert(initialPosition.y)));
    // Remove the original regression line
    d3.select(".regLineOriginal").remove();
    // Remove the difference line
    d3.select(".regsDiffLine").remove();
    // Remove the difference text
    d3.select("#regsDiffText").remove();
    // Remove the residual and leverage text
    d3.select("#residualText").remove();
    // Reset the color of the circle
    const color = hat.map((d, i) => d[i]);
    draggedCircle.style("fill", (d) => colScale(color[d]));
  }

  return d3.drag().on("start", start).on("drag", drag).on("end", end);
}

async function drawScatter() {
  // 1. Access data
  const { data, lm, xMean, hat } = await getInputs();
  // 2. Create chart dimensions
  const dimensions = getDimensions();
  // 3. Draw canvas
  const { wrapper, bounds } = drawCanvas("#wrapper", dimensions);
  // 4. Create scales
  const { xScale, yScale, colScale } = getScales(data, dimensions);
  // 5. Draw data
  drawData(data, bounds, xMean, xScale, yScale, lm, hat, colScale);
  // 6. Draw peripherals
  drawAxes(bounds, dimensions, xScale, yScale);
  // 7. Set up interactions
  drag = getDragCircleInteraction(
    bounds,
    data,
    xScale,
    yScale,
    colScale,
    xMean,
    lm,
    hat
  );
  bounds.selectAll("circle").call(drag);
}
drawScatter();
