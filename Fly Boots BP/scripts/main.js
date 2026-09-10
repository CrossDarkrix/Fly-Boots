import {
  world,
  system,
  InputButton, 
  ButtonState,
  EquipmentSlot
} from "@minecraft/server";

let tick = 0;

const flyingPlayers = new Set();

const HORIZ_FORCE = 0.12;
const HORIZ_FORCE_SPRINT = 0.18;

const MAX_XZ_VEL = 3.5;
const MAX_XZ_VEL_SPRINT = 5.0;

const DRAG = 0.35;

function stopFly(player) {
    flyingPlayers.delete(player.id);
}


system.runInterval(() => {
  tick++;
  for (const player of world.getPlayers()) {
    const id = player.id;

    const equipment = player.getComponent("equippable");
    const feetItem = equipment?.getEquipment(EquipmentSlot.Feet);
    const hasFly = feetItem?.typeId === "custom:rocket_boots";

    if (!hasFly) {
       if (flyingPlayers.has(id)) {
            stopFly(player);
                   }
        continue;
    }
	if (tick % 17 === 0 && !player.isOnGround) {
        player.addEffect("slow_falling", 100, {
            amplifier: 1,
            showParticles: false
        });
    }

    const jump = player.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed;
    const sneak = player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed || player.isSneaking;
    const sprint = player.isSprinting;
    const movement = player.inputInfo.getMovementVector();
    const moving = Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01;

    if (!player.isOnGround && !flyingPlayers.has(id)) {flyingPlayers.add(id);}
	if (!player.isOnGround) {player.setDynamicProperty("rocketAirborne", true);}
	if (tick % 4 === 0 && !player.isOnGround && flyingPlayers.has(id) && !sneak) {
        player.addEffect("levitation", 1, {
            amplifier: 0,
            showParticles: false
        });
    }
    if (flyingPlayers.has(id) && tick % 5 === 0) {
      try {
        for(let i = 0; i < 1; i++) {
          player.dimension.spawnParticle("minecraft:blue_flame_particle", { 
            x: player.location.x + (Math.random() - 0.5) * 0.3, 
            y: player.location.y - 0.2, 
            z: player.location.z + (Math.random() - 0.5) * 0.3 
          });
          player.dimension.spawnParticle("minecraft:large_smoke_particle", { 
            x: player.location.x + (Math.random() - 0.5) * 0.3, 
            y: player.location.y - 0.2, 
            z: player.location.z + (Math.random() - 0.5) * 0.3 
          });
        }
      } catch (e) {}
    }
    if (
            player.isOnGround &&
            player.getDynamicProperty("rocketAirborne")
        ) {
            player.setDynamicProperty("rocketAirborne", false);

            try {
                player.addEffect("resistance", 40, {
                    amplifier: 255,
                    showParticles: false
                });
            } catch (e) {}
        }
    const vel = player.getVelocity();
    let impulseX = 0, impulseY = 0, impulseZ = 0;
    if (jump) {
       impulseY = 0.15;
        }
    else if (sneak) {
        impulseY = -0.12;
        }
    else {
        if (vel.y < 0) {
            impulseY = 0.01;
        }
    }

    if (!player.isOnGround && moving) {
        const look = player.getViewDirection();
        const dirX = look.x * movement.y + look.z * movement.x;
        const dirZ = look.z * movement.y - look.x * movement.x;
        const len = Math.hypot(dirX, dirZ);

        if (len > 0) {
            const normX = dirX / len;
            const normZ = dirZ / len;
            const maxV = sprint ? MAX_XZ_VEL_SPRINT : MAX_XZ_VEL;
            const f = sprint ? HORIZ_FORCE_SPRINT : HORIZ_FORCE;
            const horizontalSpeed = Math.hypot(vel.x, vel.z);

            if (horizontalSpeed < maxV) {
                let nextX = vel.x + normX * f;
                let nextZ = vel.z + normZ * f;
                const nextSpeed = Math.hypot(nextX, nextZ);

                if (nextSpeed > maxV) {
                    const scale = maxV / nextSpeed;
                    nextX *= scale;
                    nextZ *= scale;
                }
                impulseX = nextX - vel.x;
                impulseZ = nextZ - vel.z;
            }
        }
    } else if (!player.isOnGround) {
        if (Math.abs(vel.x) > 0.02) impulseX = -vel.x * DRAG;
        if (Math.abs(vel.z) > 0.02) impulseZ = -vel.z * DRAG;
    }

    if (Math.abs(impulseX) > 0.001 || Math.abs(impulseY) > 0.001 || Math.abs(impulseZ) > 0.001) {
        player.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ });
    }
  }
}, 1);