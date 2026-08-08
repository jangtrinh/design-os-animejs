// Loads the compressed gltf copy from phase 01 (public/model/scene.gltf) and
// indexes every named node so arm-rig.ts can find the flat sibling hierarchy
// described in plan.md (base_LP / main_arm_LP / sub_arm_LP / wheel_LP).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface LoadedModel {
  root: THREE.Group;
  armRoot: THREE.Object3D; // node "LP_arm"
  meshes: THREE.Mesh[];
  byName: Map<string, THREE.Object3D>;
  pbrMaterial: THREE.MeshStandardMaterial; // 24 meshes share this one instance ("white")
}

export function loadArmModel(url: string, onProgress: (ratio01: number) => void): Promise<LoadedModel> {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    onProgress(total > 0 ? loaded / total : 0);
  };

  const loader = new GLTFLoader(manager);

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        try {
          resolve(processGltf(gltf.scene));
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

function processGltf(root: THREE.Group): LoadedModel {
  const byName = new Map<string, THREE.Object3D>();
  const meshes: THREE.Mesh[] = [];
  let pbrMaterial: THREE.MeshStandardMaterial | undefined;

  root.traverse((obj) => {
    if (obj.name) byName.set(obj.name, obj);
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      meshes.push(mesh);

      const material = mesh.material;
      if (Array.isArray(material)) {
        throw new Error(`Unexpected multi-material mesh: ${mesh.name}`);
      }
      material.side = THREE.FrontSide;
      material.transparent = true;
      material.opacity = 1;
      pbrMaterial = material as THREE.MeshStandardMaterial;
    }
  });

  const armRoot = byName.get('LP_arm');
  if (!armRoot) throw new Error('LP_arm node missing');
  if (!pbrMaterial) throw new Error('No mesh material found in model');

  return { root, armRoot, meshes, byName, pbrMaterial };
}
