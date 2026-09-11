import {
  world,
  system,
  InputButton, 
  ButtonState,
  EquipmentSlot
} from "@minecraft/server";

let tick = 0;

const HORIZ_FORCE = 0.12;
const HORIZ_FORCE_SPRINT = 0.18;

const MAX_XZ_VEL = 3.5;
const MAX_XZ_VEL_SPRINT = 5.0;

const DRAG = 0.35;

const DOUBLE_TAP_WINDOW = 4;

system.runInterval(() => {
  tick++;
  for (const player of world.getPlayers()) {
    const id = player.id;

    const equipment = player.getComponent("equippable");
    const feetItem = equipment?.getEquipment(EquipmentSlot.Feet);
    const hasFly = feetItem?.typeId === "custom:rocket_boots";

    if (!hasFly) {
        player.setDynamicProperty(
            "rocketFly",
            false
        );
        continue;
    }

    const jump = player.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed;
	const lastJumpPressed = player.getDynamicProperty("lastJumpPressed") ?? false;
    const lastJumpTick = player.getDynamicProperty("lastJumpTick") ?? -999;
    const sneak = player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed || player.isSneaking;
    const sprint = player.isSprinting;
    const movement = player.inputInfo.getMovementVector();
    const moving = Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01;
    if (jump && !lastJumpPressed) {
        if (tick - lastJumpTick <= DOUBLE_TAP_WINDOW && !player.isOnGround) {

            const flyEnabled =
                player.getDynamicProperty("rocketFly") === true;

            if (flyEnabled) {

                player.setDynamicProperty(
                    "rocketFly",
                    false
                );
                player.clearVelocity();
                try {
                    player.addEffect("resistance", 80, {
                        amplifier: 255,
                        showParticles: false
                    });
                } catch (e) {}

            } else {

                player.setDynamicProperty(
                    "rocketFly",
                    true
                );

            }

            player.setDynamicProperty(
                "lastJumpTick",
                -999
            );

        } else {

            player.setDynamicProperty(
                "lastJumpTick",
                tick
            );

        }
    }

    player.setDynamicProperty(
        "lastJumpPressed",
        jump
    );
	const isFlying = hasFly && player.getDynamicProperty("rocketFly") === true;
    if (tick % 4 === 0 && isFlying && !jump && !sneak) {
        player.addEffect("levitation", 5, {
            amplifier: 0,
            showParticles: false
        });
    }
    if (isFlying && tick % 5 === 0) {
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
    if (!player.isOnGround) {
    player.setDynamicProperty("rocketAirborne", true);
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
	if (isFlying) {
        if (jump) {
           impulseY = 0;
            }
        else if (sneak) {
            impulseY = -0.12;
            }
        else {
            impulseY = 0;
        }
    }
        if (
        !isFlying &&
        !moving &&
        !jump &&
        !sneak &&
        Math.abs(vel.x) < 0.15 &&
        Math.abs(vel.y) < 0.15 &&
        Math.abs(vel.z) < 0.15
    ) {
        player.clearVelocity();
    }
    if (isFlying && moving) {
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
world.beforeEvents.entityHurt.subscribe((event) => {
    const player = event.hurtEntity;

    if (player.typeId !== "minecraft:player")
        return;

    const equipment = player.getComponent("equippable");
    const feetItem = equipment?.getEquipment(EquipmentSlot.Feet);

    if (feetItem?.typeId !== "custom:rocket_boots")
        return;

    if (event.damageSource.cause !== "fall")
        return;

    event.cancel = true;
});