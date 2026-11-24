/** @license 
  * Copyright 2023 Google LLC.
  * SPDX-License-Identifier: Apache-2.0 
  */

class GameOfLife {
    static Tags = ['2d', 'ca'];
    constructor(glsl, gui) {
        this.glsl = glsl;
        this.lastTime = null;
        this.phase = 0.0;
        this.speed = 1.0;
        this.zoom = 3.0;

        function decodePattern(pattern, tag='init') {
            const lines = pattern.split('\n').map(s=>s.trim());
            const h = lines.length, w = Math.max(...lines.map(s=>s.length));
            const flat = lines.map(s=>s.padEnd(w, '.')).join('').split('');
            const data = new Uint8Array(flat.map(c=>c=='O'));
            return glsl({}, {data, size:[w,h], format:'r8', tag});
        }
        this.initTex = decodePattern(`
        ........................O
        ......................O.O
        ............OO......OO............OO
        ...........O...O....OO............OO
        OO........O.....O...OO
        OO........O...O.OO....O.O
        ..........O.....O.......O
        ...........O...O
        ............OO`);

        gui.add(this, 'reset');
        gui.add(this, 'speed', 0, 20, 0.1);
        gui.add(this, 'zoom', 0.5, 10.0, 0.1);
        this.reset();
    }

    reset() {
        this.phase = 0.0;
        this.state = this.glsl({initTex:this.initTex,
            FP: `initTex(I-ivec2(10,24)).r!=0.0`
        }, {size: [64, 64], format: 'r8', story:2, tag: 'state'});
    }

    step() {
        this.glsl({FP:`
            float c = Src(I).x;
            ivec2 sz = Src_size();
            int x=I.x,l=(x-1+sz.x)%sz.x,r=(x+1)%sz.x;
            int y=I.y,d=(y-1+sz.y)%sz.y,u=(y+1)%sz.y;
            #define S(u,v) (Src(ivec2(u,v)).x)
            float nhood = S(l,y)+S(r,y)+S(x,u)+S(x,d)+S(l,u)+S(l,d)+S(r,u)+S(r,d);
            FOut = vec4(nhood<3.5 && nhood>1.5 && (c+nhood) > 2.5);
        `}, this.state);        
    }

    frame(glsl, params) {
        const {time} = params;
        const dt = this.lastTime === null ? 0.0 : Math.min(time - this.lastTime, 0.1);
        this.lastTime = time;
        this.phase += dt * this.speed;
        const steps = Math.min(Math.floor(this.phase), 10);
        for (let i = 0; i < steps; ++i) {
            this.step();
        }
        this.phase -= Math.floor(this.phase);
        let t = this.phase;
        t = t*t*(3.0-2.0*t);

        const [T1, T0] = this.state;
        glsl({T0, T1, time, Aspect:'fit', Clear:0.8, t, zoom: this.zoom, DepthTest:1, perspective:0.5, 
            Grid: [...this.state[0].size,6], ...params, VP:`
            float v1 = T1(ID.xy).x;
            float v = mix(T0(ID.xy).x, v1, t);
            VPos.xyz = cubeVert(XY, ID.z)*vec3(0.4, 0.4, 0.1);
            varying float color = sqrt(cubeVert(vec2(0), ID.z).z*0.5+0.5);
            
            VPos.xyz = erot(VPos.xyz, normalize(vec3(1,1,0)), v*PI);
            VPos.xy += vec2(ID.xy)+0.2 - vec2(T0_size())*0.5;// - time/4.0;
            VPos.xyz *= 2.0 / vec2(Grid).xyx;
            VPos.xyz *= zoom;
            VPos = wld2proj(VPos.xyz);
            `, FP:`
            vec2 c = XY; c*=c; c*=c;
            float a = 1.0-(c.x+c.y)*0.2;
            FOut = vec4(mix(0.5, color, a));
            `});
    }
}
